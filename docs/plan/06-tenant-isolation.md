# Этап 6. Tenant isolation

**Срок: 2 дня**

Инвариант проекта: `user_id` берётся из сессии, никогда из тела запроса, ни в одном эндпоинте.

Сейчас в коде `CreateCarDto.userId` и `POST /stock { userId }` приходят из body, а
`Updateable<CarsTable>` позволяет сменить `user_id` через PATCH — это временно, до этапа 5. На этом
этапе поле удаляется из DTO и из типа `UpdateCarInput` (`Omit<Updateable<CarsTable>, 'user_id'>`);
тест про `userId` в body ниже должен ловить именно этот регресс.

- Repository-методы принимают `userId` первым аргументом и **всегда** добавляют `AND user_id = $n`.
  Метода `findById(id)` без `userId` в repository не существует.
- Guard кладёт `{ userId, deviceId }` в request; контроллер берёт только оттуда.
- Тесты: два пользователя, `GET/PATCH/DELETE /cars/{чужой id}` → 404 (не 403 — не раскрывать
  существование). `POST /cars` с `userId` чужого в body → поле игнорируется, машина создаётся у
  автора сессии.
- Тест на устройство: `DELETE /devices/:id` чужого устройства → 404.
