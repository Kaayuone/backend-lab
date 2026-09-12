# Этап 10. Entitlement resolver

**Срок: 3–4 дня**

Как в версии 1, с контрактом из `BILLING_ENTITLEMENTS.md` §2:

```json
{
  "localAccess": "basic | subscription | lifetime",
  "cloudAccess": true,
  "cloudUntil": "2026-12-15T00:00:00Z",
  "sources": ["PLAY_LOCAL_LIFETIME", "ADMIN_CLOUD_GRANT"]
}
```

`resolveEntitlements(userId, now)` — чистая функция над входными строками, детерминированная,
принимает `now` явно. Unit-тесты на все комбинации из версии 1 плюс: несколько одновременных
grants с разными `expires_at` (побеждает самый поздний), revoked grant не считается, grant в
будущем (`starts_at > now`) не считается.
