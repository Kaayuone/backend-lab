# Этап 2. Nest, миграции, тесты, ledger, конфиг, логи — в процессе

> Текущее состояние репозитория, таблица изменений относительно v2 и решения 1–3 — в
> [00-overview.md](00-overview.md).

**Срок: 5–6 дней, из них ~1.5 уже потрачено**

Порядок шагов важен: каждый опирается на предыдущий. Один шаг — один-два коммита.

## 2.0. Уборка (2 часа)

- `git rm --cached garage-rest-api/tsconfig.build.tsbuildinfo`, добавить `*.tsbuildinfo` в `.gitignore`.
- `npm rm @nestjs/observe @nestjs/mau`; убрать `ObserveModule` / `ObserveInstrument` из
  `app.module.ts` и `main.ts`.
- Удалить `AppController`, `AppService`, `app.controller.spec.ts`, `DatabaseService`.
  `test/app.e2e-spec.ts` удалить — замена появится в 2.3.
- Удалить `cars.controller.spec.ts` и `cars.service.spec.ts`. Правило на весь план: **тестов вида
  `should be defined` не существует**. Сервис проверяется либо unit-тестом с фейковым репозиторием
  (когда в нём есть логика), либо e2e — оба варианта появятся ниже.
- `vite-tsconfig-paths` → `resolve.tsconfigPaths: true` в обоих vitest-конфигах.
- `KyselyCarsRepository`: сигнатуры `create` / `update` на `CreateCarInput` / `UpdateCarInput`.
- `.env.example` с `DATABASE_URL`. Загрузка `.env` в dev: `import 'dotenv/config'` первой строкой
  `main.ts` (или `node --env-file=.env` в скриптах). В контейнере `.env` не читается никогда —
  переменные приходят из окружения хоста; это правило проекта, а не удобство.
- `stock/` пока **не коммитить** — только после подключения к БД в 2.4, не заглушкой.

Проверка: `npm test` зелёный (остаётся один файл — `cars.mapper.spec.ts`), `npm run lint` без
warning'ов, `npm run build` проходит.

## 2.1. Compose в репозитории (1 час)

`docker-compose.yml` в корне `backend-lab/`:

```yaml
services:
  postgres:
    image: postgres:18-alpine          # то, что уже крутится; не понижать до 17
    container_name: garage-postgres
    environment:
      POSTGRES_USER: garage
      POSTGRES_PASSWORD: garage_dev_password
      POSTGRES_DB: garage
    ports: ['5432:5432']
    volumes:
      - pgdata:/var/lib/postgresql     # PG18: весь каталог, не .../data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U garage -d garage']
      interval: 5s
  pgadmin:
    image: dpage/pgadmin4
    ports: ['5050:80']
    volumes:
      - pgadmin:/var/lib/pgadmin
    depends_on:
      postgres: { condition: service_healthy }
volumes:
  pgdata:
    name: garage-postgres-data         # существующий volume — данные сохраняются
  pgadmin:
    name: backend-lab-pgadmin-data
```

Переезд с `docker run` на compose: `docker stop garage-postgres backend-lab-pg-admin && docker rm
garage-postgres backend-lab-pg-admin`, затем `docker compose up -d`. Volume с теми же именами
подхватывается, данные остаются. Проверка: `SELECT count(*) FROM stock_items` → 4.

Тестовую БД через `/docker-entrypoint-initdb.d` **не** создавать: на непустом volume init-скрипты
не выполняются, а volume уже непустой. `garage_test` создаёт тестовый `globalSetup` (2.3).
Схему через init-скрипты тоже не повторять: схема — это миграции (2.2), а не docker.

Пока в репозитории нет seed-скрипта (2.2), `docker compose down -v` **не запускать** — это
единственная копия ручных данных.

## 2.2. Kysely Migrator (полдня) — перенесено из 3.2

`src/database/migrations/` + `Migrator` + `FileMigrationProvider`. Скрипт `npm run migrate`
(`src/database/migrate.ts`) — отдельно от старта API: в проекте миграции — отдельный шаг деплоя.

```text
001_initial         перенос 001_create_initial_tables.sql из garage-database как есть
                    (users, cars, service_records, stock_items с quantity)
002_stock_ledger    шаг 2.4
```

Первый запуск `migrate` против живой `garage`: таблицы из 001 уже есть, а таблицы `kysely_migration`
нет. Либо 001 пишется идемпотентно (`CREATE TABLE IF NOT EXISTS`, как в исходном SQL) и просто
проходит поверх существующей схемы, либо один раз руками вставить строку 001 в
`kysely_migration`. Первый вариант проще; понять, почему для настоящих миграций `IF NOT EXISTS` —
плохая привычка (маскирует расхождение схемы и истории).

`npm run db:seed` (`src/database/seed.ts`, dev-only, гард `NODE_ENV !== 'production'`): один
пользователь, две машины, четыре позиции склада — те же, что сейчас лежат в БД, чтобы `down -v`
перестал быть потерей. Seed — не миграция: он не входит в `kysely_migration` и никогда не бежит
на тестовой БД (там только фикстуры).

Прогон, как в v2: пустая БД → все → добавить следующую → накатить → снести БД → все с нуля.
Повторный `migrate` — no-op. Только вперёд: `down` не писать. Прогонять на второй БД
(`CREATE DATABASE garage_scratch`), а не на `garage`, пока seed не готов.

`database.types.ts` дописать до всех таблиц из 001: `service_records`, `stock_items`. Правило:
типы соответствуют миграции, а не наоборот; новая миграция — обновлённый интерфейс в том же коммите.

После этого шага `garage-database/` замораживается: его единственная ценность уже переехала. Удалять
на этапе 4 вместе с реструктуризацией.

## 2.3. Минимальная тестовая инфраструктура (1 день) — перенесено из 3.3

- `TEST_DATABASE_URL` (`…/garage_test`). Нет переменной → тесты падают с понятным сообщением, а не
  бегут в dev-БД.
- `test/setup/global-setup.ts` (`globalSetup` в `vitest.config.e2e.ts`): подключиться к
  служебной БД `postgres`, `CREATE DATABASE garage_test`, если её нет (роль `garage` — superuser,
  права есть), затем прогнать `Migrator` на `garage_test`. Так тестовая БД не зависит от
  init-скриптов docker и от состояния volume.
- `test/setup/db.ts`: `truncateAll()` — `TRUNCATE users, cars, service_records, stock_items
  RESTART IDENTITY CASCADE`, вызывается в `beforeEach`. Отдельный `pg.Pool` с `max >= 10`.
- Фикстуры: `withUser()`, `withCar(userId)`, позже `withStockItem(userId, balance)`.
- `createTestApp()`: `Test.createTestingModule({ imports: [AppModule] })` с `DATABASE_URL =
  TEST_DATABASE_URL`. Тот же `ValidationPipe` и тот же префикс, что в `main.ts` — вынести в
  `src/app.setup.ts` как `configureApp(app)`, чтобы e2e и prod не расходились.

Первый настоящий e2e — `test/cars.e2e-spec.ts`:

1. `POST /api/v1/cars` → 201 `{ id }`; `GET /api/v1/cars/:id` → та же машина;
2. `POST` с `{ "mileage": "banana" }` → 400;
3. `GET /api/v1/cars/999` → 404;
4. `PATCH` пустым телом → 400;
5. `PATCH` с неизвестным полем → 400 (`forbidNonWhitelisted` действительно работает).

Unit-тест `CarsService` с фейковым `CarsRepository` (`vi.fn()`) писать только там, где есть логика
(«пустой PATCH → 400»). Тест, дублирующий e2e, не писать.

Проверка: `npm run test:e2e` зелёный при поднятом compose; без `TEST_DATABASE_URL` — красный с
понятной ошибкой.

## 2.4. Ledger + `POST /stock/:id/install` (1.5 дня) — было 2.0

Миграция `002_stock_ledger`. В живой базе четыре позиции склада с `quantity` 4 / 0 / 1 / 4 —
порядок шагов **обязателен**: сначала ledger, потом перенос остатков, и только потом `DROP`:

```sql
CREATE TABLE stock_movements (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stock_item_id BIGINT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('purchase','installation','manual_out','return','disposal')),
  delta         NUMERIC(12,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_item_idx ON stock_movements(stock_item_id);

-- перенос остатков: одно движение 'purchase' на позицию; нулевые остатки не переносим
INSERT INTO stock_movements (stock_item_id, type, delta)
SELECT id, 'purchase', quantity FROM stock_items WHERE quantity > 0;

ALTER TABLE stock_items DROP COLUMN quantity;

-- правило «деньги всегда с валютой» — заодно первое ALTER на таблице с данными
ALTER TABLE service_records ADD COLUMN currency TEXT;
UPDATE service_records SET currency = 'RUB';          -- backfill 4 существующих строк
ALTER TABLE service_records ALTER COLUMN currency SET NOT NULL;
```

Проверка сразу после миграции: `SELECT stock_item_id, SUM(delta) FROM stock_movements GROUP BY 1`
даёт 4 / 1 / 4 для позиций 1 / 3 / 4, позиция 2 отсутствует (баланс 0).

`amount` в 001 — `NOT NULL`, поэтому парное правило `CHECK ((amount IS NULL) = (currency IS NULL))`
здесь вырождается в `NOT NULL` на `currency`. Само правило пригодится, когда появится первая
nullable-денежная колонка (promo, grants); тогда — именно CHECK, а не два независимых NULL.

Время — только `TIMESTAMPTZ` в UTC (в 001 это уже так, у сервера `TimeZone = UTC`;
`service_records.serviced_at DATE` — оставить, это дата события, не момент).

**Деньги и NUMERIC в TypeScript.** `pg` возвращает NUMERIC строкой; `cars.mapper.ts` делает
`Number(car.mileage)`. Для пробега допустимо, для `amount` / `delta` — нет: держать строкой до
границы API либо хранить минорные единицы (`amount_minor BIGINT`). Решить в 002 и не возвращаться.

Stock-модуль — переписать сгенерированный скелет:

```text
POST /api/v1/stock                 { userId, name }               → 201 { id }
GET  /api/v1/stock/:id                                            → { id, name, balance }
POST /api/v1/stock/:id/movements   { type: 'purchase', delta }    → 201 { id }
POST /api/v1/stock/:id/install     { carId, mileage? }            → 201 { movementId, serviceRecordId }
```

PATCH / DELETE из генератора — удалить. `StockRepository` интерфейс + `KyselyStockRepository`,
как в cars. `StockModule` импортирует `DatabaseModule`. Все id — через DTO с regex, как
`CarIdParamsDto`, не `+id`.

`installPart` — одна транзакция `db.transaction().execute(trx => ...)`:

1. `SELECT id FROM stock_items WHERE id = $1 FOR UPDATE` (`.forUpdate()` или `sql`-тег);
2. `SELECT COALESCE(SUM(delta), 0)` → меньше 1 → `INSUFFICIENT_STOCK`;
3. `INSERT stock_movements (type 'installation', delta -1)`;
4. `INSERT service_records`.

Внутри — только `trx`, ни одного `this.db`. Второй вариант —
`SELECT pg_advisory_xact_lock(hashtext('stock:' || $1))` — сделать флагом или отдельной
реализацией репозитория, чтобы прогнать тот же тест на обоих и словами объяснить разницу:
`FOR UPDATE` блокирует строку и защищает только тех, кто тоже читает с `FOR UPDATE`; advisory lock
не трогает строку вообще и работает по договорённости о ключе.

Тесты, `test/stock.e2e-spec.ts`:

1. **rollback**: ошибка между шагами 3 и 4 (инъекция через тестовый провайдер или флаг) → `SUM(delta)`
   не изменился, `service_records` пусто;
2. **race**: `Promise.all` 10 × `POST /stock/:id/install` при остатке 3 → ровно 3 × 201, 7 × 409
   `INSUFFICIENT_STOCK`, `SUM(delta) = 0`;
3. **без `FOR UPDATE` тест 2 красный** — прогнать один раз, убедиться, что тест ловит race, потом
   включить блокировку. Это первый тест в репо, который был красным до исправления.

## 2.5. Error contract (полдня) — было 2.7

Как в v2: `DomainError { code, httpStatus, details }`, глобальный `ExceptionFilter`, формат
`{ code, message, details }`. Маппинг в одном месте:

- `DomainError` → его статус и код;
- ошибка `ValidationPipe` (сейчас `BadRequestException` с массивом сообщений) → 400
  `VALIDATION_ERROR`, `details.issues`;
- любой другой `HttpException` → его статус, код из статуса (`NOT_FOUND`, …);
- всё остальное → 500 `INTERNAL`, без stack в теле, с записью в лог.

Коды — `const` union в `src/common/errors/error-codes.ts`; на этапе 4 переедут в `@lab/contracts`.
В `CarsService` `NotFoundException` → `CarNotFoundError(id)`; в `StockService` —
`InsufficientStockError`.

Тесты: 404 по cars, 409 по stock, 400 по валидации — все три с точным телом. Добавить в
существующие e2e, не отдельный файл.

## 2.6. Fastify adapter (полчаса + починка e2e)

Решение 1. `@nestjs/platform-fastify`,
`NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`. В `createTestApp()`
после `app.init()` — `await app.getHttpAdapter().getInstance().ready()`, иначе supertest получит
пустой сервер. `app.listen(port, '0.0.0.0')` — иначе в контейнере не слушает. Убрать
`@nestjs/platform-express`, `@types/express`.

Критерий: все e2e зелёные без изменений в тестах.

## 2.7. Конфиг (полдня) — было 2.3

`src/config/env.ts`: `loadEnv(): Env` — читает `process.env`, проверяет и возвращает plain-объект.
Пока class-validator (`validateSync` на классе `EnvSchema`), чтобы не тащить Valibot раньше
этапа 4. Переменные: `DATABASE_URL`, `PORT`, `NODE_ENV`, `LOG_LEVEL` (`JWT_SECRET` — на этапе 5).

`ConfigModule` с `useValue: loadEnv()`; Kysely-фабрика берёт URL из `Env`, а не из `process.env`.
`TEST_DATABASE_URL` — не часть `Env`: это переменная тест-раннера, тест подставляет её в
`DATABASE_URL` до сборки модуля.

Тесты (unit): `loadEnv()` без `DATABASE_URL` бросает; `PORT=abc` бросает. Проверить руками:
`npm run start` без переменной → ненулевой код выхода, порт не открыт.

## 2.8. Pino + redaction (полдня) — было 2.4

Как в v2. `nestjs-pino` на Fastify: у Fastify уже есть встроенный pino, поэтому
`LoggerModule.forRoot({ useExisting: true, ... })` и логгер передаётся в `FastifyAdapter({ logger })`
— два логгера в одном процессе не нужны. `app.useLogger(app.get(Logger))`, `bufferLogs: true`.
Request id — `genReqId` из заголовка `x-request-id` или `randomUUID()`. Redaction — список в
конфиге логгера: `req.headers.authorization`, `refreshToken`, `email`, `googleSub`,
`purchaseToken`.

Тест: перехватить поток логгера (`pino.destination` / `stream` в тестовом `LoggerModule`), сделать
запрос с `Authorization: Bearer secret`, убедиться, что в строке `[Redacted]` и есть `reqId`.

## 2.9. Health / ready (1 час) — было 2.5

`GET /api/v1/health` — процесс жив, ничего не проверяет. `GET /api/v1/ready` — `select 1` через
Kysely, при ошибке 503 в формате error contract (`code: NOT_READY`). Тест: подменить `KYSELY_DB`
провайдером, у которого запрос падает → 503.

## Критерий выхода

Как в v2, плюс:

- `npm test && npm run test:e2e` зелёные из чистого `docker compose down -v && up`;
- `garage-rest-api/` больше не содержит шаблонного кода из `nest new`;
- в репо есть хотя бы один тест, который был красным до исправления (race в 2.4).
