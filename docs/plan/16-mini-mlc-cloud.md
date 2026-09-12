# Этап 16. Финальный учебный проект — Mini MLC Cloud

**Срок: 1–2 недели**

К этому моменту в `backend-lab` уже есть почти всё из списка версии 1. Поэтому этап 16 — не
«написать ещё раз», а **собрать из готовых модулей сквозные сценарии** и убедиться, что они
проходят от начала до конца через Caddy → API → Postgres → worker → MinIO, а не в изолированных
тестах.

## Что добавить

Только то, чего ещё нет:

- вторая LWW-сущность `cars` и связь `records → cars` по `global_id` (FK через локальный int
  + UNIQUE `global_id`, как в проекте);
- `GET /sync/status` — cursor устройства, `last_successful_sync_at`, `needs_attention` count;
- `GET /me` с entitlements и storage;
- device-скрипты из этапа 11 расширить до `cars + records + attachments`.

## Сквозные сценарии (каждый — один автотест поверх поднятого compose)

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

## Критерий выхода

Все восемь сценариев зелёные одной командой поверх `docker compose up`. Если какой-то сценарий
требует новой функциональности, которой нет в этапах 2–15, — это сигнал, что там пробел, а не
повод расширять этап 16.
