# Этап 3. Kysely вглубь, expand/contract, тесты как основа

> Текущее состояние репозитория, таблица изменений относительно v2 и решения 1–3 — в
> [00-overview.md](00-overview.md).

**Срок: 3 дня** (было 4–5: migrator и инфра ушли в этап 2)

## 3.1. Kysely осознанно (1 день)

Уже используется — теперь разобрать. Включить `log: ['query', 'error']` в `Kysely`, для каждого
метода репозиториев записать SQL, который ожидаешь, и сверить. Список из v2 (`innerJoin`,
`groupBy`, `trx` vs `db`, `sql`-теги, `RETURNING`, параметры) без изменений. Дополнительно, из
фактического кода:

- `Selectable / Insertable / Updateable` — что они делают с `GeneratedAlways` и `ColumnType`;
  почему `CreatedAtColumn` с `never` на update — правильно;
- `executeTakeFirstOrThrow` vs `executeTakeFirst` — create бросает, find возвращает `undefined`;
- `numDeletedRows` — `bigint`, отсюда `> 0n`;
- `GET /stock/:id` с `balance` — `leftJoin` + `sum` + `groupBy`, сверить план запроса;
- `kysely-codegen` один раз против `garage` → diff с `database.types.ts` (решение 3).

## 3.2. Expand/contract (1 день) — без изменений

`cars.name → cars.title` через три миграции 003/004/005, как в v2. Плюс: e2e на cars из 2.3 — это
и есть «старый код продолжает работать»: после 003 гонять старый билд, после 004 — новый, после
005 старый должен упасть. Это ожидаемо и показывает, зачем contract делают отдельным шагом.

## 3.3. Тестовая инфра — добить (1 день)

- один unit-тест `installPart` с фейковым репозиторием: при `balance < 1` не вызывается
  `insertMovement`. Остальное — e2e;
- `test/migrations.e2e-spec.ts`: пустая БД → все миграции → повторный `migrate` применяет 0;
- один `app` на файл (`beforeAll`), `TRUNCATE` на тест — замерить, что e2e-набор укладывается в
  секунды, а не в минуты;
- `npm run test:all` = unit + e2e одной командой.

## Критерий выхода

Как в v2: можно объяснить SQL каждого Kysely-запроса в репозитории; expand/contract прогнан; тесты
rollback / race / migrations зелёные и запускаются одной командой.
