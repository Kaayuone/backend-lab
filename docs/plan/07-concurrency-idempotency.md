# Этап 7. Конкурентность и идемпотентность

**Срок: 4–5 дней**

## Мини-проект — Limited promo

По §28 плана проекта. Схема:

```text
promo_campaigns   id, status, starts_at, ends_at, max_redemptions, max_per_user
promo_codes       id, campaign_id, code_hash, display_code, max_redemptions, redemption_count
promo_redemptions id, code_id, user_id, redeemed_at, UNIQUE(code_id, user_id)
```

`POST /promos/redeem` — одна транзакция:

```text
normalize code → SELECT code FOR UPDATE → проверки статуса/дат/лимитов →
INSERT redemption → UPDATE redemption_count → COMMIT
```

Тесты:

1. 200 параллельных запросов от 200 пользователей, лимит 100 → ровно 100 успешных, 100 с
   `PROMO_EXHAUSTED`;
2. один пользователь 20 раз параллельно → 1 успех, остальные `PROMO_ALREADY_REDEEMED`
   (`UNIQUE` ловит то, что пропустила проверка);
3. **последний слот**: лимит 100, 99 занято, 2 параллельных → ровно 1;
4. без `FOR UPDATE` тест 1 должен падать — убедиться, что он действительно ловит race.

## Идемпотентность HTTP-операций

Таблица `idempotency_keys (user_id, key, request_hash, response_json, status, created_at)`:

- повтор с тем же ключом и тем же hash → тот же ответ, side effect не повторяется;
- тот же ключ, другой payload → `409 IDEMPOTENCY_CONFLICT`;
- запись ключа — **в той же транзакции**, что и side effect.

Это заготовка под `mutation_id` из sync-этапа (§34).

## Rate limit на promo

Как в auth: per-account и per-IP, failed attempts, `429`. Security-событие в лог.
