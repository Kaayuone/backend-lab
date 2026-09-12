# План обучения backend — версия 2 (с этапа 2)

> Переработка исходного плана с учётом `SERVER_ARCHITECTURE.md`, `SERVER_DEVELOPMENT_PLAN.md`,
> ADR-0001/0002. Этапы 0–1 считаются пройденными: Fastify-сервер без Nest, SQL, транзакции,
> `installPart()` с искусственной ошибкой и ROLLBACK. PostgreSQL и pgAdmin уже подняты в Docker.
>
> Два правила на весь план:
>
> 1. Один репозиторий `backend-lab/`, который растёт. Никаких отдельных tutorial-проектов.
> 2. Каждое упражнение заканчивается автотестом, который воспроизводит проблему и доказывает,
>    что она решена. «Проверил руками в pgAdmin» — не считается.

---

## Что изменилось относительно версии 1

| Было                                             | Стало                                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `stock_items.quantity` + `CHECK >= 0`            | Ledger: `balance = SUM(stock_movements.delta)`, инвариант защищается транзакцией и блокировкой (этап 2.0)   |
| Docker на этапе 14                               | Compose растёт с текущего момента: `postgres` → `postgres_test` → `minio` → полная топология               |
| Integration-тесты «когда-нибудь»                 | Тестовая инфраструктура на этапе 3, дальше каждый этап добавляет в неё тесты                                |
| Sync: один вид конфликта, `revision` «просто есть» | Sync по ADR-0002 и §34–36: revision под lock, LWW + STRICT, delete wins, bootstrap snapshot, graph_epoch |
| Google Play «потом»                              | Отдельный этап 10b: state machine подписки и идемпотентная обработка событий без Google                     |
| Нет config/logging/rate limit/expand-contract    | Добавлены в этапы 2, 3, 5, 7                                                                                 |
| Этап 16 — «Mini MLC Cloud» как большой список     | Сохранён, но сведён к сборке уже сделанного: сквозные сценарии, а не новая функциональность                |

---

## Этап 2. Nest, монорепо, конфиг, логи

**Срок: 4–5 дней**

### 2.0. Исправить учебную модель склада (полдня)

Сначала привести Garage DB к модели проекта, иначе следующие этапы будут тренировать не тот инвариант.

```sql
-- убрать
ALTER TABLE stock_items DROP COLUMN quantity;

-- остаток — только сумма ledger
CREATE TABLE stock_movements (
  id          BIGSERIAL PRIMARY KEY,
  stock_item_id BIGINT NOT NULL REFERENCES stock_items(id),
  type        TEXT NOT NULL CHECK (type IN ('purchase','installation','manual_out','return','disposal')),
  delta       NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Заодно закрепить два правила проекта на уровне схемы:

- деньги — `NUMERIC(12,2)`, всегда вместе с валютой:
  `CHECK ((amount IS NULL) = (currency IS NULL))`;
- время — только `TIMESTAMPTZ` в UTC. Клиент у тебя пишет локальное время; сервер этого не делает.

Упражнение «двойное списание» повторить на новой модели:

```text
на складе 1 единица

Request A: SELECT SUM(delta) → 1
Request B: SELECT SUM(delta) → 1
A: INSERT movement -1
B: INSERT movement -1

баланс = -1, CHECK не спасёт — колонки нет
```

Исправить двумя способами и понять разницу:

1. `SELECT ... FROM stock_items WHERE id = $1 FOR UPDATE` в начале транзакции — блокировка родительской строки;
2. `SELECT pg_advisory_xact_lock(hashtext('stock:' || $1))`.

Тест: `Promise.all` из 10 параллельных `installPart()` при остатке 3 → ровно 3 успешных, 7 получили `INSUFFICIENT_STOCK`, баланс = 0.

### 2.1. Монорепо (полдня)

```text
backend-lab/
  package.json          # "workspaces": ["apps/*", "packages/*"]
  apps/
    api/
  packages/
    contracts/          # @lab/contracts — типы DTO, коды ошибок
    validation/         # @lab/validation — Valibot-схемы
```

Понять: как `apps/api` импортирует `@lab/contracts`, как собирается пакет, как работает `tsconfig`
с `references`/`paths`. У проекта это `@my-lovely-car/contracts`; настройка та же.

### 2.2. Nest — только основа (1–2 дня)

- `Module`, `Controller`, `Provider`, DI-контейнер. Уметь объяснить словами, что делает контейнер,
  когда `A` зависит от `B`.
- `Guard` (auth), `ExceptionFilter` (error contract), `Interceptor` (request id / timing),
  `Middleware`, lifecycle hooks (`onModuleInit` для миграций/проверки БД, `onApplicationShutdown`
  для закрытия pool).
- `Pipe` — **одну** тонкую: `ValibotPipe`, которая принимает схему и возвращает типизированный
  объект. Это ровно то место, где Valibot встраивается в Nest; дальше pipes не нужны.
- Fastify adapter, префикс `/api/v1`.

### 2.3. Конфиг, валидируемый при старте (полдня)

`SERVER_ARCHITECTURE.md` §5. Схема Valibot для `process.env`:

```text
DATABASE_URL, PORT, NODE_ENV, JWT_SECRET, LOG_LEVEL
```

Нет переменной или не прошла схему → процесс завершается с ненулевым кодом **до** открытия порта.
Проверить: запустить без `DATABASE_URL`, убедиться, что упал сразу, а не на первом запросе.

### 2.4. Pino + redaction (полдня)

`nestjs-pino` или ручной интеграция. Обязательно:

- request id в каждой строке лога;
- JSON в prod, pretty в dev;
- **список redaction как конфигурация логгера**, а не договорённость:
  `req.headers.authorization`, `refreshToken`, `email`, `googleSub`, `purchaseToken`.

Тест: сделать запрос с `Authorization: Bearer secret`, перехватить лог, убедиться, что в нём
`[Redacted]`.

### 2.5. Health / ready

- `GET /health` — процесс жив, ничего не проверяет.
- `GET /ready` — `SELECT 1` в БД, при ошибке 503.

### 2.6. Garage REST API

```text
POST   /api/v1/cars
GET    /api/v1/cars
GET    /api/v1/cars/:id
PATCH  /api/v1/cars/:id
DELETE /api/v1/cars/:id
POST   /api/v1/stock/:id/install
```

Слои: `Controller → Service → Repository → pg`. SQL только в repository. Пока сырой `pg`.

### 2.7. Error contract

Единый формат через глобальный `ExceptionFilter`:

```json
{ "code": "CAR_NOT_FOUND", "message": "Car not found", "details": {} }
```

Доменные ошибки — свои классы (`DomainError` с `code`), маппинг на HTTP-статус — в одном месте.
Коды ошибок — в `@lab/contracts` как `const enum`/union, а не строки по коду.

### Критерий выхода

- Процесс не стартует с неверным конфигом.
- В логах нет токенов.
- `POST /stock/:id/install` под параллельной нагрузкой не уводит баланс ниже нуля.
- Ответ любой ошибки соответствует error contract.

---

## Этап 3. Kysely, миграции, тестовая инфраструктура

**Срок: 4–5 дней**

### 3.1. Kysely (1–2 дня)

Заменить сырой `pg` в repository. Держать `Database`-интерфейс с типами таблиц. Включить лог
сгенерированного SQL и **каждый** запрос сверять с тем, что написал бы руками. Разобрать:

- `selectFrom / innerJoin / leftJoin / where / groupBy / orderBy`;
- `db.transaction().execute(trx => ...)` — и что внутри нужно использовать `trx`, а не `db`;
- `sql\`...\`` для того, чего в билдере нет (`FOR UPDATE`, `SUM`, advisory locks);
- `RETURNING`;
- как Kysely передаёт параметры (никогда не интерполировать значения в `sql\`\``).

### 3.2. Миграции (1 день)

Kysely `Migrator` + `FileMigrationProvider`, только вперёд:

```text
001_users
002_cars
003_stock
004_service_records
```

Прогон: пустая БД → все → добавить 005 → накатить → снести БД → все с нуля. Скрипт `npm run migrate`
отдельно от старта API (в проекте миграции — отдельный шаг деплоя до старта контейнеров).

**Expand/contract** — обязательное упражнение (`SERVER_ARCHITECTURE.md` §6). Переименовать
`cars.name → cars.title` так, чтобы старая версия кода продолжала работать между миграцией и деплоем:

```text
1. миграция: ADD COLUMN title; backfill; trigger/dual-write
2. новый код читает title, пишет оба
3. миграция: DROP COLUMN name
```

Проверить буквально: накатить миграцию 1, запустить старый код, сделать запросы, потом новый код.

### 3.3. Тестовая инфраструктура (1–2 дня) — с этого момента используется везде

В compose добавить `postgres_test` (или вторую БД в том же контейнере). Vitest:

- `globalSetup`: создать БД, накатить миграции;
- перед каждым тестом: `TRUNCATE ... RESTART IDENTITY CASCADE` (быстрее пересоздания);
- отдельный `pg.Pool` с `max >= 10` — конкурентные тесты требуют нескольких соединений;
- хелпер `withUser()` / `withCar()` для фикстур.

Первые три теста, которые обязаны существовать до перехода дальше:

1. `installPart` rollback — ошибка между шагом 2 и 3, состояние не изменилось;
2. `installPart` race — `Promise.all(10)` при остатке 3;
3. миграции применяются на пустую БД и повторный `migrate` идемпотентен.

Это фундамент для §81 плана проекта: все race/idempotency/isolation-тесты дальше пишутся сюда.

### Критерий выхода

Можно объяснить SQL каждого Kysely-запроса в репозитории. Expand/contract прогнан. Три теста зелёные
и запускаются одной командой.

---

## Этап 4. Contracts + validation

**Срок: 1–2 дня** — без изменений относительно версии 1, с двумя уточнениями.

- В `@lab/contracts` — типы `CreateCarRequest`, `CreateCarResponse`, `ApiError`, `ErrorCode`.
- В `@lab/validation` — Valibot-схемы; типы DTO выводятся через `v.InferOutput`, а не дублируются.
- Валидировать **вход** на границе всегда; **выход** — хотя бы в тестах (ловит расхождение DTO и
  реального ответа).
- Тест: `{ "mileage": "banana" }` → 400 с `code: VALIDATION_ERROR` и `details.issues`.

---

## Этап 5. Auth

**Срок: 5–7 дней**

### Теория (1 день)

Как в версии 1: authn vs authz, структура JWT, `iss/aud/sub/iat/exp`, подписан ≠ зашифрован,
access 15 мин + refresh 90 дней, rotation, reuse detection.

### Мини-проект — Sessions + Devices (3–4 дня)

`POST /auth/dev-login` с `{ externalUserId }` — только для обучения.

Схема (по `SERVER_ARCHITECTURE.md` §2):

```text
users
  id, google_sub UNIQUE, email (изменяемый атрибут, НЕ ключ),
  sessions_valid_from TIMESTAMPTZ, status, created_at

devices
  id, user_id, installation_id, platform, app_version,
  created_at, last_seen_at, revoked_at

sessions
  id, user_id, device_id, chain_id,
  refresh_hash, issued_at, expires_at, used_at, revoked_at
```

Эндпоинты:

```text
POST /auth/dev-login
POST /auth/refresh
POST /auth/logout
POST /auth/logout-all
GET  /devices
DELETE /devices/:id
```

Обязательные поведения — каждое с тестом:

1. refresh хранится только как hash; в БД сырого токена нет;
2. rotation: `refresh A → access B + refresh B`, `A` помечен `used_at`;
3. **reuse detection**: повторный `refresh A` → отозвать всю `chain_id` устройства, записать
   security-событие в лог, вернуть 401;
4. `logout-all` сдвигает `users.sessions_valid_from`; access-токен с `iat < sessions_valid_from`
   отклоняется guard'ом **до истечения `exp`**;
5. отозванное устройство (`revoked_at`) теряет доступ к защищённым эндпоинтам немедленно, даже с
   валидным access-токеном (guard проверяет устройство, а не только подпись);
6. rate limit на `/auth/*`: N неудачных попыток с одного IP/устройства → 429. Начать с in-memory
   счётчика (Redis в первом релизе не предусмотрен), понять, почему это ломается при двух
   инстансах API.

### Google Sign-In (1 день)

После того как всё выше зелёное: `google-auth-library`, `verifyIdToken({ idToken, audience })`,
проверка `iss`, извлечение `sub`/`email`. `POST /auth/google` создаёт пользователя по `google_sub`
при первом входе; смена email в Google **не** создаёт второго пользователя (тест). Разные
`audience` для debug/release — просто список в конфиге.

### Опционально: ES256-лицензия (полдня)

`BILLING_ENTITLEMENTS.md` §9. Подписать JSON с правами приватным ключом (`jose`, ES256), проверить
публичным. Это не JWT-сессия и не purchase token — отдельный артефакт. Достаточно понять механику
подписи и хранения приватного ключа только на сервере.

### Критерий выхода

Все шесть поведений покрыты тестами. Можно потерять access-токен и восстановить сессию refresh'ем;
можно воспроизвести утечку refresh и увидеть отзыв цепочки.

---

## Этап 6. Tenant isolation

**Срок: 2 дня**

Инвариант проекта: `user_id` берётся из сессии, никогда из тела запроса, ни в одном эндпоинте.

- Repository-методы принимают `userId` первым аргументом и **всегда** добавляют `AND user_id = $n`.
  Метода `findById(id)` без `userId` в repository не существует.
- Guard кладёт `{ userId, deviceId }` в request; контроллер берёт только оттуда.
- Тесты: два пользователя, `GET/PATCH/DELETE /cars/{чужой id}` → 404 (не 403 — не раскрывать
  существование). `POST /cars` с `userId` чужого в body → поле игнорируется, машина создаётся у
  автора сессии.
- Тест на устройство: `DELETE /devices/:id` чужого устройства → 404.

---

## Этап 7. Конкурентность и идемпотентность

**Срок: 4–5 дней**

### Мини-проект — Limited promo

По §28 плана проекта. Схема:

```text
promo_campaigns   id, status, starts_at, ends_at, max_redemptions, max_per_user
promo_codes       id, campaign_id, code_hash, display_code, max_redemptions, redemption_count
promo_redemptions id, code_id, user_id, redeemed_at, UNIQUE(code_id, user_id)
```

`POST /promos/redeem` — одна транзакция:

```text
normalize code → SELECT code FOR UPDATE → проверки статуса/дат/лимитов →
INSERT redemption → UPDATE redemption_count → COMMIT
```

Тесты:

1. 200 параллельных запросов от 200 пользователей, лимит 100 → ровно 100 успешных, 100 с
   `PROMO_EXHAUSTED`;
2. один пользователь 20 раз параллельно → 1 успех, остальные `PROMO_ALREADY_REDEEMED`
   (`UNIQUE` ловит то, что пропустила проверка);
3. **последний слот**: лимит 100, 99 занято, 2 параллельных → ровно 1;
4. без `FOR UPDATE` тест 1 должен падать — убедиться, что он действительно ловит race.

### Идемпотентность HTTP-операций

Таблица `idempotency_keys (user_id, key, request_hash, response_json, status, created_at)`:

- повтор с тем же ключом и тем же hash → тот же ответ, side effect не повторяется;
- тот же ключ, другой payload → `409 IDEMPOTENCY_CONFLICT`;
- запись ключа — **в той же транзакции**, что и side effect.

Это заготовка под `mutation_id` из sync-этапа (§34).

### Rate limit на promo

Как в auth: per-account и per-IP, failed attempts, `429`. Security-событие в лог.

---

## Этап 8. Background jobs + pg-boss

**Срок: 3 дня**

Как в версии 1: `POST /reports` → job → worker → status; `retry`, `failure`, duplicate delivery,
idempotent processing (`singletonKey`, проверка «уже сделано» в начале handler'а).

Второй job — **account deletion workflow** (`BILLING_ENTITLEMENTS.md` §10, план §67):

```text
POST /account/delete       → status = deletion_pending, deleted_at = now()+30d,
                             отозвать все сессии, остановить доступ
POST /account/delete/cancel → status = active (только внутри окна)
worker: finalize_deletion  → удалить доменные данные, оставить минимальный audit
```

Тесты с подменой времени (`vi.useFakeTimers` или инжектируемый `Clock`): отмена внутри окна
работает; после окна — нет; повторный `finalize` для уже удалённого — no-op.

Отдельный процесс `apps/worker` с тем же конфигом и логгером, своим `/health`.

---

## Этап 9. S3 / MinIO

**Срок: 3–4 дня**

Добавить `minio` в compose. Без изменений относительно версии 1 плюс:

- `assets.status`: `pending → completed | failed`; `pending` старше N часов чистит worker
  (`cleanup_orphan_assets` — вот здесь ему место);
- квота: `used_bytes` пользователя считается по `completed`-ассетам, `init` отклоняет при
  превышении (`QUOTA_EXCEEDED`), `GET /me/storage`;
- **дедупликация `complete`**: второй `complete` для того же asset → тот же ответ, без
  повторной проверки объекта;
- тесты по §83: failed init, upload без complete, complete ×2, sha256 mismatch, удалённый owner,
  orphan cleanup, quota exceeded.

Помнить семантику проекта: `stage → commit → finalize/cleanup`. БД и S3 — не одна транзакция;
компенсация — через worker.

---

## Этап 10. Entitlement resolver

**Срок: 3–4 дня**

Как в версии 1, с контрактом из `BILLING_ENTITLEMENTS.md` §2:

```json
{
  "localAccess": "basic | subscription | lifetime",
  "cloudAccess": true,
  "cloudUntil": "2026-12-15T00:00:00Z",
  "sources": ["PLAY_LOCAL_LIFETIME", "ADMIN_CLOUD_GRANT"]
}
```

`resolveEntitlements(userId, now)` — чистая функция над входными строками, детерминированная,
принимает `now` явно. Unit-тесты на все комбинации из версии 1 плюс: несколько одновременных
grants с разными `expires_at` (побеждает самый поздний), revoked grant не считается, grant в
будущем (`starts_at > now`) не считается.

---

## Этап 10b. Billing state machine без Google

**Срок: 2–3 дня** — новый этап

Настоящий Google Play Developer API и RTDN в лаборатории не нужны: самое сложное там — не вызов
API, а обработка событий. Это отрабатывается без Google целиком.

```text
billing_events
  id, external_event_id UNIQUE, subscription_id, type, event_time, received_at, processed_at, status

play_subscriptions
  id, user_id, product_id, state, expires_at, last_event_time, version
```

Типы событий: `purchased, renewed, canceled, in_grace_period, on_hold, expired, revoked, refunded`.

`processBillingEvent(event)`:

1. `INSERT ... ON CONFLICT (external_event_id) DO NOTHING` — дубль не обрабатывается дважды;
2. событие старше `last_event_time` подписки → **не** откатывает состояние, но фиксируется;
3. переход состояния — таблица допустимых переходов, недопустимый → `status = rejected`, алерт;
4. после обновления подписки — пересчёт entitlements.

Тесты по §84: `duplicate RTDN`, `delayed RTDN` (expired пришёл после renewed с более поздним
`event_time`), `events out of order`, `refund` после `renewed`, `revoke`.

Источник событий — worker-job из `pg-boss` (в проекте это будет Pub/Sub → worker). Хендлер
идемпотентен по `external_event_id`.

---

## Этап 11. Cloud Sync

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

### Шаг 1 — Идемпотентность по §34

- `mutation_id` + `request_hash` + `result_json` пишутся **в той же транзакции**, что и доменная
  мутация и `sync_changes`;
- повтор → тот же `result_json`, revision не растёт (тест: 3 повтора → 1 строка в
  `sync_changes`);
- тот же `mutation_id`, другой hash → `MUTATION_MISMATCH`;
- **старый `graph_epoch`** в мутации → `status: gone`, мутация отвергается.

### Шаг 2 — Версии и конфликты по ADR-0002

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

### Шаг 3 — Revision под блокировкой (§35) — ключевое упражнение

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

### Шаг 4 — Tombstones

`delete` → `deleted_at` + change `operation: delete`. Retention 180 суток (§37): worker чистит
`sync_changes` старше, и pull с `after` ниже минимальной сохранённой revision →
`CURSOR_TOO_OLD` → клиент обязан пройти bootstrap заново. Тест с подменой времени.

### Шаг 5 — Bootstrap snapshot (§36)

`GET /sync/bootstrap` — одна транзакция `REPEATABLE READ`: читает `revision` из
`user_sync_state` и все живые сущности; возвращает `{ snapshot, snapshotRevision, graphEpoch }`.
Тест: push во время bootstrap → snapshot не содержит новую сущность, но следующий
`pull?after=snapshotRevision` её содержит.

### Шаг 6 — Pull с пагинацией

`limit` по количеству изменений, но страница **никогда не режет revision**: если следующая
revision не помещается — вернуть меньше. `nextCursor` — последняя полностью выданная revision.
Тест: операция из 5 изменений при `limit = 3`.

### Шаг 7 — graph_epoch

«Сброс облака»: `graph_epoch + 1`, `revision = 0`, старые `sync_changes` и `sync_mutations`
недействительны. Мутации со старым epoch → `gone`. Тест: очередь, накопленная до сброса, не
применяется после.

### Шаг 8 — Два клиента

`device-a.ts`, `device-b.ts` — каждый со своим локальным состоянием (JSON-файл или SQLite),
outbox и cursor. Сценарии A, B, C, E из §82 плана как автотесты:

```text
A offline; B update; A update; A online → LWW: один победил, loser в sync_conflicts
A delete; B offline; B online → delete пришёл через pull
mutation ×3 → applied once
fresh device: bootstrap → граф совпадает с сервером
```

### Критерий выхода

Тест шага 3 на «дыру BIGSERIAL» существует и был красным до исправления. Все четыре ветки
конфликтов покрыты. Два скрипта проходят сценарии A/B/C/E без ручного вмешательства.

---

## Этап 12. Compound operations

**Срок: 3 дня**

`operation_id` объединяет мутации; группа применяется `all or nothing`, класс всегда STRICT
(ADR-0002: поэлементное слияние составной операции запрещено).

`Install part` = `stock_movement (-1)` + `installed_part` + `service_record`:

- одна транзакция, одна revision, `change_index 0..2`;
- невалидна мутация C → `ROLLBACK` всех трёх, ни одна не в `sync_changes`, `mutation_id`
  всех трёх не записаны (повтор должен пройти после исправления);
- инвариант склада проверяется внутри группы под `FOR UPDATE` строки `stock_items`;
- `baseVersion` расходится у любой из сущностей группы → вся группа в `needs_attention`;
- сценарий D из §82: прерванная initial upload — повтор не дублирует.

Тест «два устройства ставят последнюю деталь одновременно» → ровно одно успешное, второе —
STRICT conflict, а не отрицательный баланс.

---

## Этап 13. Admin, audit, promo поверх entitlements

**Срок: 2–3 дня**

- `admin_users (id, email, role 'owner'|'support', password_hash или google_sub)` — **не**
  `users.is_admin`; своя таблица сессий, свой guard, свой `logout`.
- `POST /admin/users/:id/grants`, `DELETE /admin/grants/:id` (= `revoked_at`, не DELETE-строки).
- `admin_audit_log` append-only: `admin_id, user_id, action, resource_type, resource_id,
  before_json, after_json, reason, created_at`. Нет `UPDATE`/`DELETE` на таблицу — проверить
  через `REVOKE` на роли БД для API.
- `reason_code` обязателен; `other` требует comment (валидация в Valibot).
- Promo redeem из этапа 7 теперь создаёт `entitlement_grant`, и `resolveEntitlements` его видит
  (end-to-end тест: redeem → `sources` содержит `PROMO_LOCAL_LIFETIME`).

---

## Этап 14. Полная Docker-топология и «сломай сервер»

**Срок: 3–4 дня**

Compose доводится до топологии проекта:

```text
caddy → api
        admin (статика, можно заглушку)
        worker
        postgres
        minio
```

- multi-stage `Dockerfile` для `api` и `worker` (общий base);
- `healthcheck` у postgres, `depends_on: condition: service_healthy`;
- миграции — отдельный one-shot сервис/команда **до** старта api;
- `.env` не в образе; секреты — только через окружение хоста.

«Сломай сервер», каждый пункт — с ожидаемым результатом:

| Действие                                | Ожидание                                                             |
| --------------------------------------- | -------------------------------------------------------------------- |
| `kill postgres`                         | `/health` 200, `/ready` 503; api не падает, восстанавливается сам    |
| `kill worker` посреди job               | job вернулся в очередь, после рестарта обработан ровно один раз      |
| `docker rm postgres`, up заново         | volume сохранил данные и jobs                                        |
| сломать `DATABASE_URL`                  | api не стартует, лог понятный, caddy отдаёт 502, а не зависает       |
| рестарт api под нагрузкой               | in-flight запросы завершились или получили ошибку, дублей в БД нет   |

GitHub Actions: `lint` / `type-check` / `test` с `services: postgres` — интеграционные тесты
из этапа 3 бегут в CI.

---

## Этап 15. Backup / PITR

**Срок: 2–3 дня**

По `SERVER_ARCHITECTURE.md` §7: `pg_basebackup` + непрерывная архивация WAL, `pg_dump` — только
дополнительный логический экспорт.

1. В контейнере postgres: `archive_mode = on`, `archive_command` → копирование в бакет MinIO
   (`mc cp` или `aws s3 cp`); `archive_timeout = 900` (RPO ≤ 15 мин).
2. `pg_basebackup -D /backup/base -X stream`.
3. Создать `cars A, B, C`; через минуту `DELETE FROM cars` — запомнить время.
4. Новый чистый контейнер postgres: restore base backup, `restore_command`,
   `recovery_target_time` за 10 секунд до DELETE, `recovery.signal`.
5. Поднять api против восстановленной БД — `GET /cars` возвращает A, B, C.
6. Записать фактические RPO/RTO. Это репетиция restore drill из §75.

Понять: почему `pg_dump` не годится как база для WAL, что такое `timeline` после восстановления,
как контролировать возраст последнего архивированного WAL-сегмента.

---

## Этап 16. Финальный учебный проект — Mini MLC Cloud

**Срок: 1–2 недели**

К этому моменту в `backend-lab` уже есть почти всё из списка версии 1. Поэтому этап 16 — не
«написать ещё раз», а **собрать из готовых модулей сквозные сценарии** и убедиться, что они
проходят от начала до конца через Caddy → API → Postgres → worker → MinIO, а не в изолированных
тестах.

### Что добавить

Только то, чего ещё нет:

- вторая LWW-сущность `cars` и связь `records → cars` по `global_id` (FK через локальный int
  + UNIQUE `global_id`, как в проекте);
- `GET /sync/status` — cursor устройства, `last_successful_sync_at`, `needs_attention` count;
- `GET /me` с entitlements и storage;
- device-скрипты из этапа 11 расширить до `cars + records + attachments`.

### Сквозные сценарии (каждый — один автотест поверх поднятого compose)

```text
1. dev-login → register device → включить Cloud (admin grant) → initial push графа
   → второе устройство: bootstrap → графы совпадают

2. Устройство A offline меняет record; B меняет тот же record; оба online
   → LWW применён, loser в sync_conflicts, оба устройства сошлись к одному состоянию

3. Оба устройства ставят последнюю деталь со склада
   → одна compound-группа applied, вторая в needs_attention, баланс = 0

4. Upload вложения: init → MinIO → complete; kill worker посреди cleanup;
   restart → orphan удалён ровно один раз

5. Promo redeem 200 параллельных → 100 grants → resolveEntitlements у всех 100 показывает
   PROMO_*, у остальных нет

6. Cloud grant истёк → push/pull получают ENTITLEMENT_REQUIRED, данные на сервере не тронуты;
   новый grant → sync продолжается с того же cursor

7. account delete → deletion_pending → cancel внутри окна → sync работает;
   повторно delete → сдвинуть время → worker finalize → bootstrap отдаёт 404/410,
   в admin_audit_log запись осталась

8. Восстановление: DELETE FROM records; PITR на момент до удаления → API поднят →
   устройство с старым cursor делает pull без ошибок
```

### Критерий выхода

Все восемь сценариев зелёные одной командой поверх `docker compose up`. Если какой-то сценарий
требует новой функциональности, которой нет в этапах 2–15, — это сигнал, что там пробел, а не
повод расширять этап 16.

---

## Пересмотренные приоритеты

| Тема                        | Глубина |
| --------------------------- | ------- |
| SQL / транзакции / locking  | ★★★★★   |
| Concurrency / idempotency   | ★★★★★   |
| Sync algorithms             | ★★★★★   |
| **Integration testing**     | ★★★★★   |
| TypeScript                  | ★★★★★   |
| Kysely / миграции           | ★★★★☆   |
| Auth / JWT / OIDC           | ★★★★☆   |
| NestJS                      | ★★★☆☆   |
| Billing state machine       | ★★★★☆   |
| Docker / compose            | ★★★★☆   |
| S3                          | ★★★☆☆   |
| PITR                        | ★★★☆☆   |
| Caddy / CI                  | ★★☆☆☆   |

Список «не изучать» из версии 1 остаётся без изменений.

---

## График

При 2–3 часах в день, с учётом того, что этапы 0–1 пройдены:

```text
Неделя 1      Этап 2 (ledger-fix, монорепо, Nest, config, Pino, error contract)
Неделя 2      Этап 3 (Kysely, миграции, expand/contract, тестовая инфра) + Этап 4
Неделя 3      Этап 5 (auth) + Этап 6 (tenant isolation)
Неделя 4      Этап 7 (promo race, idempotency) + Этап 8 (pg-boss, account deletion)
Неделя 5      Этап 9 (MinIO) + Этап 10 (entitlements)
Неделя 6      Этап 10b (billing events) + Этап 13 (admin/audit/promo)
Неделя 7–8    Этап 11 (sync, шаги 1–8)
Неделя 9      Этап 12 (compound) + Этап 14 (Docker, break the server, CI)
Неделя 10     Этап 15 (PITR)
Неделя 11–12  Этап 16 (сквозные сценарии Mini MLC Cloud)
```

Sync намеренно стоит на неделях 7–8 целиком: если он выйдет за две недели — это нормально,
этапы 12–16 сдвигаются, но ничего не переделывается.

Критерий прогресса не меняется: не «прочитал», а «воспроизвёл проблему тестом, тест был красным,
исправил, тест зелёный».
