# Этап 15. Backup / PITR

**Срок: 2–3 дня**

По `SERVER_ARCHITECTURE.md` §7: `pg_basebackup` + непрерывная архивация WAL, `pg_dump` — только
дополнительный логический экспорт.

1. В контейнере postgres: `archive_mode = on`, `archive_command` → копирование в бакет MinIO
   (`mc cp` или `aws s3 cp`); `archive_timeout = 900` (RPO ≤ 15 мин). Стартовая точка сейчас:
   `wal_level = replica` (достаточно), `archive_mode = off`. Параметры — через `command:` в
   compose (`postgres -c archive_mode=on ...`), не правкой `postgresql.conf` внутри volume; в
   образе 18 путь к данным `/var/lib/postgresql/18/docker`.
2. `pg_basebackup -D /backup/base -X stream`.
3. Создать `cars A, B, C`; через минуту `DELETE FROM cars` — запомнить время.
4. Новый чистый контейнер postgres: restore base backup, `restore_command`,
   `recovery_target_time` за 10 секунд до DELETE, `recovery.signal`.
5. Поднять api против восстановленной БД — `GET /cars` возвращает A, B, C.
6. Записать фактические RPO/RTO. Это репетиция restore drill из §75.

Понять: почему `pg_dump` не годится как база для WAL, что такое `timeline` после восстановления,
как контролировать возраст последнего архивированного WAL-сегмента.
