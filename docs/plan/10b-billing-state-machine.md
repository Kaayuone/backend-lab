# Этап 10b. Billing state machine без Google

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
