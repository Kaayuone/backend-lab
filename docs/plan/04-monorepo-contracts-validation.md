# Этап 4. Монорепо, contracts, validation

> Текущее состояние репозитория, таблица изменений относительно v2 и решения 1–3 — в
> [00-overview.md](00-overview.md).

**Срок: 2–3 дня** (было 1–2: сюда переехал монорепо)

## 4.1. Монорепо (полдня) — было 2.1

```text
backend-lab/
  package.json          # "workspaces": ["apps/*", "packages/*"]
  docker-compose.yml
  docker/
  docs/
  apps/
    api/                # ← git mv garage-rest-api
  packages/
    contracts/          # @lab/contracts — типы DTO, коды ошибок
    validation/         # @lab/validation — Valibot-схемы
```

`git mv garage-rest-api apps/api`; `garage-database/` — `git rm -r` (SQL уже в миграциях с 2.2).
`npm install` из корня, один lock-файл. `tsconfig` с `references` / `paths` — как в v2. У проекта
это `@my-lovely-car/contracts`; настройка та же.

## 4.2. Contracts + Valibot (1–2 дня)

Как в v2, с учётом решения 2:

- в `@lab/contracts` — `CreateCarRequest`, `CarResponse`, `ApiError`, `ErrorCode` (переезд
  `error-codes.ts` из 2.5);
- `@lab/validation` на Valibot; `ValibotPipe` заменяет `ValidationPipe`; `class-validator`,
  `class-transformer`, `@nestjs/mapped-types` удаляются; `CreateCarDto` / `UpdateCarDto` /
  `CarIdParamsDto` становятся `v.InferOutput` схем; `loadEnv()` из 2.7 переводится на ту же схему;
- ветка `ValidationPipe` в `ExceptionFilter` заменяется на ветку `ValiError`, `details.issues` —
  из `v.flatten`;
- e2e на cars и stock **не меняются** и остаются зелёными — критерий, что замена валидатора
  эквивалентна. Тест `{ "mileage": "banana" }` уже есть с 2.3 и должен проходить на обоих;
- валидировать выход хотя бы в тестах: `CarResponse` из `GET /cars/:id` прогоняется через схему
  ответа.
