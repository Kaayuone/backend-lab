# План обучения backend — версия 3 (сверка с репозиторием)

> Версия 2 писалась до того, как в `backend-lab/` появился код на Nest. Версия 3 — та же программа
> (этапы 2–16, те же инварианты, те же ADR), но этапы 2–4 переписаны под то, что реально лежит в
> `garage-rest-api/` на 12 сентября 2026. Этапы 5–16 перенесены из версии 2 без изменений, кроме
> одной пометки в этапе 6 и сдвига графика.
>
> Два правила на весь план остаются:
>
> 1. Один репозиторий `backend-lab/`, который растёт. Никаких отдельных tutorial-проектов.
> 2. Каждое упражнение заканчивается автотестом, который воспроизводит проблему и доказывает,
>    что она решена. «Проверил руками в pgAdmin» — не считается.

---

## Что реально есть в репозитории (12 сентября 2026)

| Пункт версии 2                                              | Факт                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Этапы 0–1 «пройдены»: Fastify, SQL, транзакции, `installPart()` с ROLLBACK | В репо только каркас Fastify (`garage-database/`): pg-плагин, `GET /health/database`, один SQL-файл `001_create_initial_tables.sql`. Кода транзакций и `installPart()` в репозитории **нет**.                                                                |
| PostgreSQL и pgAdmin в Docker                               | Подняты через `docker run`, compose-файла в репозитории **нет**. Контейнер `garage-postgres` (`postgres:18-alpine`, volume `garage-postgres-data`), `backend-lab-pg-admin` (volume `backend-lab-pgadmin-data`). Правило «compose растёт с текущего момента» не выполняется, пока файла нет в git. |
| 2.1 Монорепо `apps/*` + `packages/*`                        | Нет. Два плоских проекта с отдельными `package.json` и lock-файлами: `garage-database/` (Fastify 5, TS 5.9) и `garage-rest-api/` (Nest 12, TS 6, ESM).                                                                                                                     |
| 2.2 Nest, Fastify adapter, префикс `/api/v1`                | Nest 12 стоит, но на `@nestjs/platform-express`. Префикс `api/v1` и `enableShutdownHooks()` — сделано. Guard / ExceptionFilter / Interceptor / lifecycle hooks — нет.                                                                                                     |
| 2.2 `ValibotPipe`                                           | Вместо Valibot — `class-validator` + `class-transformer`, глобальный `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`. Работает.                                                                                                                            |
| 2.3 Конфиг, валидируемый при старте                         | Только проверка `DATABASE_URL` внутри фабрики Kysely плюс `select 1` до старта. Схемы нет. Загрузки `.env` тоже нет: ни `dotenv`, ни `@nestjs/config`, ни `--env-file` — переменная берётся из окружения оболочки.                                                        |
| 2.4 Pino + redaction                                        | Нет. Вместо этого в `AppModule` подключён `@nestjs/observe` с `YOUR_APP_KEY` — шаблон из `nest new`.                                                                                                                                                                       |
| 2.5 `/health`, `/ready`                                     | Нет. Есть `GET /` → `Hello World!`.                                                                                                                                                                                                                                        |
| 2.6 Cars CRUD, слои Controller → Service → Repository       | **Сделано полностью**: DTO, `CarIdParamsDto` с regex, mapper с тестом, интерфейс `CarsRepository` + `KyselyCarsRepository` через DI-токен. `userId` приходит в body — до этапа 5 это нормально.                                                                            |
| 2.6 «Пока сырой `pg`»                                       | Уже не актуально: репозиторий сразу на Kysely 0.29. `DB`-интерфейс написан руками и покрывает только `users` и `cars`; `service_records` и `stock_items` в типах нет.                                                                                                     |
| 2.6 `POST /stock/:id/install`                               | `nest g resource stock` — сгенерированный CRUD-скелет со строками-заглушками. Не подключён ни к `DatabaseModule`, ни к БД, `id` через `+id`, DTO пустые. Не закоммичен.                                                                                                   |
| 2.7 Error contract                                          | Нет. Сервис бросает `NotFoundException` / `BadRequestException` напрямую, формат ответа — дефолтный Nest.                                                                                                                                                                  |
| 3.1 Kysely                                                  | Частично сделано раньше срока (см. 2.6).                                                                                                                                                                                                                                   |
| 3.2 Миграции                                                | Один SQL-файл в `garage-database/database/migrations/`, применяется руками. Migrator нет.                                                                                                                                                                                  |
| 3.3 Тестовая инфраструктура                                 | Vitest настроен (unit + e2e конфиги). Но `cars.service.spec.ts` и `cars.controller.spec.ts` **красные** (в тестовый модуль не передан `CARS_REPOSITORY`); единственный e2e проверяет `Hello World!` и требует живую dev-БД; `cars.mapper.spec.ts` — единственный содержательный тест. Тестовой БД нет. |

### Живая БД (снято с контейнера 12 сентября)

- PostgreSQL **18.6**, образ `postgres:18-alpine`. В образе 18-й версии данные лежат в
  `/var/lib/postgresql/18/docker`, а volume монтируется в `/var/lib/postgresql` — не в
  `/var/lib/postgresql/data`, как было до 18. Compose ниже это учитывает.
- Схема `garage` **точь-в-точь совпадает с 001**: `users`, `cars`, `service_records`,
  `stock_items(quantity INTEGER CHECK >= 0)`. Identity-колонки, FK с `ON DELETE CASCADE`, три
  индекса по `user_id` / `car_id`. Функций, триггеров, view нет. `TimeZone = UTC`.
- В базе есть **ручные данные**: 1 пользователь, 2 машины, 4 записи ТО, 4 позиции склада с
  `quantity` 4 / 0 / 1 / 4. Скрипта, который их вставил, в репозитории нет — значит, `down -v`
  сейчас теряет данные безвозвратно, а ledger-миграция обязана их перенести (2.4).
- Базы `garage_test` нет. Каталог `/docker-entrypoint-initdb.d/` пуст, и init-скрипты на
  непустом volume уже не выполнятся — тестовую БД должен создавать код (2.3), а не docker.
- Роль `garage` — **superuser**. Для разработки нормально; на этапе 13 `REVOKE` на superuser не
  действует, поэтому там появится отдельная роль для API.
- `wal_level = replica`, `archive_mode = off`, `max_connections = 100` — стартовая точка для
  этапа 15; пула `max = 10` в тестах хватает с запасом.

Мелочи, которые стоят в дороге:

- `tsconfig.build.tsbuildinfo` закоммичен;
- `@nestjs/mau`, `@nestjs/observe` в зависимостях;
- `DatabaseService` — пустой класс; `AppController` / `AppService` — Hello World;
- `vite-tsconfig-paths` в vitest-конфигах — Vite уже умеет это через `resolve.tsconfigPaths: true`;
- `KyselyCarsRepository.create/update` дублируют типы инлайном вместо `CreateCarInput` / `UpdateCarInput`;
  `Updateable<CarsTable>` разрешает менять `user_id` через PATCH — на этапе 6 это станет дырой;
- `tsc` и `oxlint` чистые (два warning'а в stock-заглушке).

**Итог.** Этап 2 начат и сделан примерно на треть, но в порядке, отличном от плана: Kysely пришёл
раньше срока, а ledger, конфиг, логи, error contract и health не начаты. Тестов, которые что-то
доказывают, пока нет. Ближайший коммит — шаг 2.0 в [02-nest-foundation.md](02-nest-foundation.md).

---

## Что изменилось относительно версии 2

| Было (v2)                                        | Стало (v3)                                                                                   | Почему                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Этапы 0–1 пройдены, `installPart()` есть         | `installPart()` пишется заново на ledger-модели как первый интеграционный тест (2.4)         | В репо его нет; повторять на старой модели `quantity` смысла нет                                   |
| 2.1 Монорепо в начале этапа 2                    | Монорепо переносится в этап 4                                                                | Workspaces нужны, когда есть второй пакет (`@lab/contracts`). Сейчас это переезд ради переезда     |
| Kysely — этап 3                                  | Kysely уже в коде; 3.1 сжат до «дописать типы, транзакции, `sql`-теги, сверить SQL»          | Факт                                                                                               |
| Migrator — этап 3.2                              | Migrator переносится в этап 2 (2.2)                                                          | Нужен для тестовой БД и ledger-миграции; Kysely уже есть, стоимость — час                          |
| Тестовая инфра — этап 3.3                        | Минимальная инфра (`garage_test`, globalSetup, TRUNCATE, фикстуры) — этап 2 (2.3)            | Race-тест из 2.0 нельзя написать без неё. В v2 это было противоречие                               |
| Fastify adapter «по умолчанию»                   | Отдельный шаг 2.6 с решением: перейти сейчас, пока в приложении два модуля                   | Полчаса сейчас против дня на этапе 5, когда появятся guard'ы и логгер                              |
| Valibot с этапа 2                                | class-validator до этапа 4; переход на Valibot — вместе с `@lab/validation`                  | Не переписывать работающие DTO дважды                                                              |
| Compose «уже есть»                               | Compose-файл — первый инфраструктурный коммит этапа 2 (2.1), поверх существующих volume       | Его нет в репо; контейнеры подняты `docker run`, в БД ручные данные                                |
| 2.0 Ledger: `DROP COLUMN quantity` первым шагом  | 002: создать ledger → перенести остатки из `quantity` → `DROP`; плюс seed-скрипт             | В живой базе 4 позиции склада с остатками; `down -v` сейчас теряет их безвозвратно                 |
| Тестовая БД через init-скрипт docker             | `garage_test` создаёт `globalSetup` тестов                                                   | Init-скрипты на непустом volume не выполняются, а volume уже непустой                              |
| `garage-database/` не упоминается                | Замораживается; удаляется на этапе 4 после переезда SQL в миграции                           | Единственная ценность — 001-миграция                                                               |
| Этап 2: 4–5 дней                                 | Этап 2: 5–6 дней; этап 3: 3 дня; этап 4: 2–3 дня                                             | Перераспределение, суммарно +1 неделя к графику                                                    |

---

## Три решения, которые нужно зафиксировать

Все обратимые, у каждого есть рекомендация. Если выбираешь иначе — поменяй один шаг ниже, остальной
план не меняется.

1. **HTTP-адаптер.** Целевой проект — Fastify, сейчас Express. Рекомендация: перейти на шаге 2.6,
   **до** Pino (nestjs-pino на Fastify подключается иначе) и до guard'ов. Все e2e-тесты должны
   остаться зелёными без правок — это и проверка, что настройка приложения вынесена правильно.
2. **Валидация.** class-validator сейчас, Valibot в целевом проекте. Рекомендация: не трогать до
   этапа 4; там заменить `ValidationPipe` на `ValibotPipe` одновременно с появлением
   `@lab/validation`. Если останешься на class-validator — из этапа 4 убираются только
   `ValibotPipe` и `v.InferOutput`, остальное (contracts, тест на `VALIDATION_ERROR`) без изменений.
3. **Типы БД.** Руками (`database.types.ts`) или `kysely-codegen`. Рекомендация: руками до конца
   этапа 3, потому что таблиц пять; на 3.1 один раз прогнать codegen как проверку, что ручные типы
   не разошлись со схемой.

---

## Этапы

Один файл — один этап. Порядок файлов — порядок прохождения.

| Файл                                                                   | Этап                                            | Срок       |
| ---------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| [02-nest-foundation.md](02-nest-foundation.md)                         | 2. Nest, миграции, тесты, ledger, конфиг, логи  | 5–6 дней   |
| [03-kysely-expand-contract.md](03-kysely-expand-contract.md)           | 3. Kysely вглубь, expand/contract, тесты        | 3 дня      |
| [04-monorepo-contracts-validation.md](04-monorepo-contracts-validation.md) | 4. Монорепо, contracts, validation          | 2–3 дня    |
| [05-auth.md](05-auth.md)                                               | 5. Auth                                         | 5–7 дней   |
| [06-tenant-isolation.md](06-tenant-isolation.md)                       | 6. Tenant isolation                             | 2 дня      |
| [07-concurrency-idempotency.md](07-concurrency-idempotency.md)         | 7. Конкурентность и идемпотентность             | 4–5 дней   |
| [08-background-jobs.md](08-background-jobs.md)                         | 8. Background jobs + pg-boss                    | 3 дня      |
| [09-s3-minio.md](09-s3-minio.md)                                       | 9. S3 / MinIO                                   | 3–4 дня    |
| [10-entitlements.md](10-entitlements.md)                               | 10. Entitlement resolver                        | 3–4 дня    |
| [10b-billing-state-machine.md](10b-billing-state-machine.md)           | 10b. Billing state machine без Google           | 2–3 дня    |
| [11-cloud-sync.md](11-cloud-sync.md)                                   | 11. Cloud Sync                                  | 2 недели   |
| [12-compound-operations.md](12-compound-operations.md)                 | 12. Compound operations                         | 3 дня      |
| [13-admin-audit-promo.md](13-admin-audit-promo.md)                     | 13. Admin, audit, promo поверх entitlements     | 2–3 дня    |
| [14-docker-topology.md](14-docker-topology.md)                         | 14. Docker-топология и «сломай сервер»          | 3–4 дня    |
| [15-backup-pitr.md](15-backup-pitr.md)                                 | 15. Backup / PITR                               | 2–3 дня    |
| [16-mini-mlc-cloud.md](16-mini-mlc-cloud.md)                           | 16. Mini MLC Cloud — сквозные сценарии          | 1–2 недели |

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

При 2–3 часах в день. Отсчёт — от 9 сентября 2026, когда появился `garage-rest-api`; на 12 сентября
сделаны cars CRUD и каркас stock.

```text
Неделя 1  (9–15 сен)   Этап 2, шаги 2.0–2.4: уборка, compose, migrator, тест-инфра, ledger + install
Неделя 2  (16–22 сен)  Этап 2, шаги 2.5–2.9 (error contract, Fastify, конфиг, Pino, health) + Этап 3
Неделя 3               Этап 4 (монорепо, contracts, Valibot) + теория этапа 5
Неделя 4               Этап 5 (auth) + Этап 6 (tenant isolation)
Неделя 5               Этап 7 (promo race, idempotency) + Этап 8 (pg-boss, account deletion)
Неделя 6               Этап 9 (MinIO) + Этап 10 (entitlements)
Неделя 7               Этап 10b (billing events) + Этап 13 (admin/audit/promo)
Неделя 8–9             Этап 11 (sync, шаги 1–8)
Неделя 10              Этап 12 (compound) + Этап 14 (Docker, break the server, CI)
Неделя 11              Этап 15 (PITR)
Неделя 12–13           Этап 16 (сквозные сценарии Mini MLC Cloud)
```

Относительно версии 2 — плюс одна неделя: этап 2 вырос за счёт migrator и тестовой инфраструктуры,
которые в v2 стояли позже, чем тесты, которым они нужны. Sync по-прежнему стоит двумя неделями
целиком; если выйдет за них — этапы 12–16 сдвигаются, ничего не переделывается.

Критерий прогресса не меняется: не «прочитал», а «воспроизвёл проблему тестом, тест был красным,
исправил, тест зелёный». Первый такой тест в репо должен появиться на шаге 2.4.
