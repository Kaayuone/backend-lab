# Этап 11. Cloud Sync

**Срок: 2 недели** — этап переписан полностью

Вход только после того, как зелёные: FOR UPDATE, advisory locks, idempotency table, tenant tests,
Kysely-транзакции.

Одна сущность `notes` (LWW-класс) и одна `stock_movements` (STRICT-класс), чтобы обе ветки
ADR-0002 были видны на одном протоколе.

```text
notes
  id, global_id UUID UNIQUE, user_id, text,
  version INT, local_updated_at TIMESTAMPTZ, deleted_at, server_updated_at

user_sync_state
  user_id PK, graph_epoch INT, revision BIGINT

sync_changes
  user_id, graph_epoch, revision, change_index, entity_type, entity_global_id,
  operation, payload, changed_at
  PRIMARY KEY (user_id, graph_epoch, revision, change_index)

sync_mutations
  user_id, mutation_id UNIQUE, request_hash, result_json, applied_revision, created_at

sync_conflicts
  id, user_id, entity_global_id, loser_payload, winner_payload, kind ('lww'|'strict'), created_at
```

API: `POST /sync/push`, `GET /sync/pull?after=`, `GET /sync/bootstrap`.

## Шаг 1 — Идемпотентность по §34

- `mutation_id` + `request_hash` + `result_json` пишутся **в той же транзакции**, что и доменная
  мутация и `sync_changes`;
- повтор → тот же `result_json`, revision не растёт (тест: 3 повтора → 1 строка в
  `sync_changes`);
- тот же `mutation_id`, другой hash → `MUTATION_MISMATCH`;
- **старый `graph_epoch`** в мутации → `status: gone`, мутация отвергается.

## Шаг 2 — Версии и конфликты по ADR-0002

`baseVersion == version` → применить, `version + 1`.

`baseVersion < version`:

- **LWW** (`notes`): сравнить `local_updated_at` входящей мутации и текущей строки; победитель
  записывается, проигравший — в `sync_conflicts` (состояние не теряется). Результат мутации:
  `applied` или `superseded`. Правило тай-брейка — сверить с `SYNC_ARCHITECTURE.md` §3.
- **STRICT** (`stock_movements`, любая compound-группа): `SYNC_CONFLICT` с
  `currentServerEntity`, `attemptedMutation`, `conflictType`; строка в `needs_attention`.
- **Delete wins**: `update` на сущность с `deleted_at` → `superseded`/`gone`, независимо от
  timestamps.

Тесты на каждую из четырёх веток.

## Шаг 3 — Revision под блокировкой (§35) — ключевое упражнение

Сначала сделать **неправильно**: `revision BIGSERIAL` в `sync_changes`. Написать тест, который
ловит дыру:

```text
Tx A: INSERT change → revision 5, await (не коммитит)
Tx B: INSERT change → revision 6, COMMIT
Client: GET /sync/pull?after=4 → получил [6], cursor = 6
Tx A: COMMIT
Client: GET /sync/pull?after=6 → пусто. Изменение 5 потеряно навсегда.
```

Потом исправить:

```text
BEGIN
SELECT revision FROM user_sync_state WHERE user_id = $1 FOR UPDATE
revision := revision + 1
INSERT sync_changes (..., revision, change_index = 0..n)
UPDATE user_sync_state SET revision = $2
COMMIT
```

Одна операция (или группа) — одна revision, изменения внутри различаются `change_index`. Тест
из «неправильного» варианта теперь должен проходить. Понять цену: push одного пользователя
сериализован — это нормально, у тебя один пользователь ≠ высокая конкурентность.

## Шаг 4 — Tombstones

`delete` → `deleted_at` + change `operation: delete`. Retention 180 суток (§37): worker чистит
`sync_changes` старше, и pull с `after` ниже минимальной сохранённой revision →
`CURSOR_TOO_OLD` → клиент обязан пройти bootstrap заново. Тест с подменой времени.

## Шаг 5 — Bootstrap snapshot (§36)

`GET /sync/bootstrap` — одна транзакция `REPEATABLE READ`: читает `revision` из
`user_sync_state` и все живые сущности; возвращает `{ snapshot, snapshotRevision, graphEpoch }`.
Тест: push во время bootstrap → snapshot не содержит новую сущность, но следующий
`pull?after=snapshotRevision` её содержит.

## Шаг 6 — Pull с пагинацией

`limit` по количеству изменений, но страница **никогда не режет revision**: если следующая
revision не помещается — вернуть меньше. `nextCursor` — последняя полностью выданная revision.
Тест: операция из 5 изменений при `limit = 3`.

## Шаг 7 — graph_epoch

«Сброс облака»: `graph_epoch + 1`, `revision = 0`, старые `sync_changes` и `sync_mutations`
недействительны. Мутации со старым epoch → `gone`. Тест: очередь, накопленная до сброса, не
применяется после.

## Шаг 8 — Два клиента

`device-a.ts`, `device-b.ts` — каждый со своим локальным состоянием (JSON-файл или SQLite),
outbox и cursor. Сценарии A, B, C, E из §82 плана как автотесты:

```text
A offline; B update; A update; A online → LWW: один победил, loser в sync_conflicts
A delete; B offline; B online → delete пришёл через pull
mutation ×3 → applied once
fresh device: bootstrap → граф совпадает с сервером
```

## Критерий выхода

Тест шага 3 на «дыру BIGSERIAL» существует и был красным до исправления. Все четыре ветки
конфликтов покрыты. Два скрипта проходят сценарии A/B/C/E без ручного вмешательства.
