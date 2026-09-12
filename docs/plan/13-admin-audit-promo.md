# Этап 13. Admin, audit, promo поверх entitlements

**Срок: 2–3 дня**

- `admin_users (id, email, role 'owner'|'support', password_hash или google_sub)` — **не**
  `users.is_admin`; своя таблица сессий, свой guard, свой `logout`.
- `POST /admin/users/:id/grants`, `DELETE /admin/grants/:id` (= `revoked_at`, не DELETE-строки).
- `admin_audit_log` append-only: `admin_id, user_id, action, resource_type, resource_id,
  before_json, after_json, reason, created_at`. Нет `UPDATE`/`DELETE` на таблицу — проверить
  через `REVOKE` на роли БД для API. Сейчас API ходит под `garage`, а это superuser — на него
  `REVOKE` не действует. Здесь появляется роль `garage_api` без superuser, миграция
  `GRANT`/`REVOKE`, и `DATABASE_URL` API переводится на неё; миграции продолжают бежать под
  `garage`. Тест: `UPDATE admin_audit_log` из API → ошибка прав, а не успех.
- `reason_code` обязателен; `other` требует comment (валидация в Valibot).
- Promo redeem из этапа 7 теперь создаёт `entitlement_grant`, и `resolveEntitlements` его видит
  (end-to-end тест: redeem → `sources` содержит `PROMO_LOCAL_LIFETIME`).
