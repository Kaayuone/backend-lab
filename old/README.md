# Архив прежних проектов

Здесь сохранены приложения, написанные до нового плана обучения:

- [garage-rest-api/](garage-rest-api/) — NestJS API, миграции, seed и тесты PostgreSQL.
- [garage-database/](garage-database/) — упражнения на Fastify и PostgreSQL.
- [docker-compose.yml](docker-compose.yml) — PostgreSQL и pgAdmin для этих приложений.

Актуальная программа находится в [docs/backend-learning/](../docs/backend-learning/README.md).
Новые проекты создаются вне `old/`. Старые можно запускать и использовать как примеры.

## Запуск архивной инфраструктуры

Из корня репозитория:

```powershell
docker compose -f .\old\docker-compose.yml up -d
```

В Compose явно сохранено имя проекта `backend-lab`, чтобы перенос файла не менял
идентичность существующей инфраструктуры. Имена volumes также сохранены.
PostgreSQL доступен на порту хоста `5433`, pgAdmin — на `5050`.
Перенос файлов сам по себе не запускает контейнеры и не применяет миграции.

## Работа с приложениями

Команды npm выполнять из каталога нужного приложения:

```powershell
cd .\old\garage-rest-api
npm run start:dev
```

Для Fastify из корня репозитория:

```powershell
cd .\old\garage-database
npm run dev
```

Конфигурации, локальные `.env` и зависимости приложений перемещены вместе с их каталогами.
При отсутствии установленных зависимостей использовать `npm ci` в соответствующем приложении.
