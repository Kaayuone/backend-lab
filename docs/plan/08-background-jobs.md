# Этап 8. Background jobs + pg-boss

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
