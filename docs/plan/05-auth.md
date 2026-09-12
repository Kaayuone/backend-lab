# Этап 5. Auth

**Срок: 5–7 дней**

## Теория (1 день)

Как в версии 1: authn vs authz, структура JWT, `iss/aud/sub/iat/exp`, подписан ≠ зашифрован,
access 15 мин + refresh 90 дней, rotation, reuse detection.

## Мини-проект — Sessions + Devices (3–4 дня)

`POST /auth/dev-login` с `{ externalUserId }` — только для обучения.

Схема (по `SERVER_ARCHITECTURE.md` §2):

```text
users
  id, google_sub UNIQUE, email (изменяемый атрибут, НЕ ключ),
  sessions_valid_from TIMESTAMPTZ, status, created_at

devices
  id, user_id, installation_id, platform, app_version,
  created_at, last_seen_at, revoked_at

sessions
  id, user_id, device_id, chain_id,
  refresh_hash, issued_at, expires_at, used_at, revoked_at
```

Эндпоинты:

```text
POST /auth/dev-login
POST /auth/refresh
POST /auth/logout
POST /auth/logout-all
GET  /devices
DELETE /devices/:id
```

Обязательные поведения — каждое с тестом:

1. refresh хранится только как hash; в БД сырого токена нет;
2. rotation: `refresh A → access B + refresh B`, `A` помечен `used_at`;
3. **reuse detection**: повторный `refresh A` → отозвать всю `chain_id` устройства, записать
   security-событие в лог, вернуть 401;
4. `logout-all` сдвигает `users.sessions_valid_from`; access-токен с `iat < sessions_valid_from`
   отклоняется guard'ом **до истечения `exp`**;
5. отозванное устройство (`revoked_at`) теряет доступ к защищённым эндпоинтам немедленно, даже с
   валидным access-токеном (guard проверяет устройство, а не только подпись);
6. rate limit на `/auth/*`: N неудачных попыток с одного IP/устройства → 429. Начать с in-memory
   счётчика (Redis в первом релизе не предусмотрен), понять, почему это ломается при двух
   инстансах API.

## Google Sign-In (1 день)

После того как всё выше зелёное: `google-auth-library`, `verifyIdToken({ idToken, audience })`,
проверка `iss`, извлечение `sub`/`email`. `POST /auth/google` создаёт пользователя по `google_sub`
при первом входе; смена email в Google **не** создаёт второго пользователя (тест). Разные
`audience` для debug/release — просто список в конфиге.

## Опционально: ES256-лицензия (полдня)

`BILLING_ENTITLEMENTS.md` §9. Подписать JSON с правами приватным ключом (`jose`, ES256), проверить
публичным. Это не JWT-сессия и не purchase token — отдельный артефакт. Достаточно понять механику
подписи и хранения приватного ключа только на сервере.

## Критерий выхода

Все шесть поведений покрыты тестами. Можно потерять access-токен и восстановить сессию refresh'ем;
можно воспроизвести утечку refresh и увидеть отзыв цепочки.
