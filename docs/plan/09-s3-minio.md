# Этап 9. S3 / MinIO

**Срок: 3–4 дня**

Добавить `minio` в compose. Без изменений относительно версии 1 плюс:

- `assets.status`: `pending → completed | failed`; `pending` старше N часов чистит worker
  (`cleanup_orphan_assets` — вот здесь ему место);
- квота: `used_bytes` пользователя считается по `completed`-ассетам, `init` отклоняет при
  превышении (`QUOTA_EXCEEDED`), `GET /me/storage`;
- **дедупликация `complete`**: второй `complete` для того же asset → тот же ответ, без
  повторной проверки объекта;
- тесты по §83: failed init, upload без complete, complete ×2, sha256 mismatch, удалённый owner,
  orphan cleanup, quota exceeded.

Помнить семантику проекта: `stage → commit → finalize/cleanup`. БД и S3 — не одна транзакция;
компенсация — через worker.
