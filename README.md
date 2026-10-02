# backend-lab

Backend features

## Структура репозитория

- `docs/backend-learning/` — актуальный план обучения.
- [old/](old/README.md) — прежние проекты `garage-rest-api`, `garage-database` и их Compose.
- [AGENTS.md](AGENTS.md) — правила работы в репозитории; коммиты создаём в `main`.

## План изучения бэкенда

Актуальный маршрут: [сильная база для своих SaaS и мобильных продуктов](docs/backend-learning/README.md).
Основной стек — TypeScript, Node.js, NestJS, PostgreSQL и Kysely; темп — до 10 часов в неделю.

- [Выбор стека и карьерные направления](docs/backend-learning/STACK.md).
- [Подробные этапы и критерии освоения](docs/backend-learning/ROADMAP.md).
- [Три практических проекта](docs/backend-learning/PROJECTS.md).
- [Прогресс и ближайшие занятия](docs/backend-learning/PROGRESS.md).

Прежние [v2](docs/BACKEND_LEARNING_PLAN_v2.md) и [v3](docs/plan/00-overview.md) устарели
и сохранены как история. Их сроки, порядок и обязательные требования больше не задают программу.

## NestJS: генерация файлов

Команды выполняются из папки NestJS-приложения:

```powershell
cd .\old\garage-rest-api
```

Общий синтаксис:

```powershell
npx nest generate <schematic> <name>
# Короткая форма
npx nest g <alias> <name>
```

Основные генераторы:

```powershell
# Модуль
npx nest generate module users
npx nest g mo users

# Контроллер
npx nest generate controller users
npx nest g co users

# Сервис
npx nest generate service users
npx nest g s users

# Готовый CRUD-ресурс: модуль, контроллер, сервис, DTO и entity
npx nest generate resource users
npx nest g res users

# Класс, например DTO
npx nest generate class users/dto/create-user.dto
npx nest g cl users/dto/create-user.dto

# Интерфейс
npx nest generate interface users/interfaces/user
npx nest g itf users/interfaces/user

# Провайдер
npx nest generate provider notifications
npx nest g pr notifications

# Middleware
npx nest generate middleware common/middleware/logger
npx nest g mi common/middleware/logger

# Guard
npx nest generate guard auth/guards/auth
npx nest g gu auth/guards/auth

# Pipe
npx nest generate pipe common/pipes/parse-id
npx nest g pi common/pipes/parse-id

# Interceptor
npx nest generate interceptor common/interceptors/logging
npx nest g itc common/interceptors/logging

# Exception filter
npx nest generate filter common/filters/http-exception
npx nest g f common/filters/http-exception

# Декоратор
npx nest generate decorator common/decorators/current-user
npx nest g d common/decorators/current-user

# WebSocket gateway
npx nest generate gateway events
npx nest g ga events

# GraphQL resolver
npx nest generate resolver users
npx nest g r users
```

Полезные флаги:

```powershell
# Показать изменения, не создавая файлы
npx nest g resource users --dry-run

# Не создавать spec-файл
npx nest g controller users --no-spec

# Создать файл без отдельной вложенной папки
npx nest g service users --flat

# Показать все генераторы и параметры
npx nest generate --help
```
