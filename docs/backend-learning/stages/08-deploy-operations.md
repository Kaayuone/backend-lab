# Этап 8. Деплой и эксплуатация

[Маршрут](../ROADMAP.md) · [← Этап 7](07-files-integrations.md) · [Этап 9 →](09-saas-payments.md)

**Оценка:** 26–36 часов. **Проект:** уже работающий проект, например Audio Bot или Spendboard.
**Нужно до начала:** контейнер этапа 3, worker и Redis этапа 6.

**Результат:** понятный полный цикл выпуска, без отдельной специализации DevOps.

## Зачем этот этап

«Работает у меня» превращается в воспроизводимый выпуск: образ собирается из lockfile, проходит
проверки, выкатывается конкретной версией и откатывается к известной. Небольшой набор практик
закрывает большинство инцидентов продукта одного разработчика: процесс не стартует, закончился
диск, БД недоступна, нужно восстановить данные.

Без VPS сначала использовать Linux VM локально, а внешний HTTPS/webhook проверить через
доступную тестовую среду. Публичный деплой не считается пройденным до реального выполнения.
Выбор хостинга, стоимость и покупка домена — отдельные решения перед этим этапом.

## Что разобрать

### Linux

SSH-ключи, пользователи и права, процессы, переменные окружения, дисковое место, логи,
listening ports и firewall. Главный навык — выяснить, почему процесс не запускается:
логи сервиса, занятый порт, права на файлы, нехватка места.

Документация: [Ubuntu Server](https://documentation.ubuntu.com/server/),
[ssh-keygen](https://man.openbsd.org/ssh-keygen),
[journalctl](https://man7.org/linux/man-pages/man1/journalctl.1.html),
[systemctl](https://man7.org/linux/man-pages/man1/systemctl.1.html),
[ss](https://man7.org/linux/man-pages/man8/ss.8.html).

### Production-образ

Фиксированная базовая версия, установка из lockfile, multi-stage сборка, процесс не от root,
минимум зависимостей. Секреты передаются при запуске, а не записываются в образ.

Документация: [рекомендации по Dockerfile](https://docs.docker.com/build/building/best-practices/),
[multi-stage builds](https://docs.docker.com/build/building/multi-stage/),
[инструкция USER](https://docs.docker.com/reference/dockerfile/),
[Node.js в Docker](https://docs.docker.com/guides/nodejs/).

### Compose на сервере

API, worker, PostgreSQL, Redis и reverse proxy во внутренних сетях. Наружу публикуется только
прокси; БД и Redis не становятся публичными сервисами. Данные — в volumes, у сервисов есть
healthcheck и политика перезапуска.

Документация: [Compose в production](https://docs.docker.com/compose/how-tos/production/),
[сети Compose](https://docs.docker.com/compose/how-tos/networking/),
[секреты в Compose](https://docs.docker.com/compose/how-tos/use-secrets/),
[конфигурация через окружение](https://12factor.net/config).

### HTTPS и reverse proxy

`Домен → DNS → Caddy → HTTPS → приложение`. Caddy получает сертификат автоматически,
если домен указывает на сервер и открыты порты 80 и 443. Приложение доверяет forwarded headers
только от своего прокси; ограничения размера и времени запроса задаются на прокси и в приложении.

Документация: [автоматический HTTPS в Caddy](https://caddyserver.com/docs/automatic-https),
[reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[Caddyfile](https://caddyserver.com/docs/quick-starts/caddyfile).

### CI и выпуск

CI устанавливает зависимости из lockfile, запускает lint, typecheck и тесты с одноразовой БД,
собирает образ с конкретным тегом. Выпуск — это развёртывание этого тега и smoke-проверка,
а не сборка на сервере.

Документация: [GitHub Actions](https://docs.github.com/en/actions),
[PostgreSQL как service container](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers),
[публикация Docker-образов](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

### Миграции и откат

Миграции выполняются отдельным шагом выпуска. Несовместимое изменение схемы проходит через
expand → совместимый код → перенос данных → contract, чтобы старая и новая версия приложения
работали с одной схемой. Откат образа не возвращает удалённые данные.

Документация: [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html).

### Backup и restore

Процедура описывает хранилище копий отдельно от сервера, доступ к нему, периодичность и срок
хранения. RPO — сколько данных допустимо потерять, RTO — сколько времени допустимо
восстанавливаться. Backup считается проверенным только после успешного restore.

Документация: [резервное копирование PostgreSQL](https://www.postgresql.org/docs/current/backup.html),
[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html),
[pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html),
[непрерывное архивирование и PITR](https://www.postgresql.org/docs/current/continuous-archiving.html).

### Наблюдаемость

Для одного проекта достаточно логов, uptime, ошибок, задержки, длины и возраста очереди,
свободного места на диске и числа соединений БД, плюс одно полезное уведомление.
Уведомление полезно, если на него нужно реагировать.

Документация: [мониторинг в книге Google SRE](https://sre.google/sre-book/monitoring-distributed-systems/),
[Prometheus](https://prometheus.io/docs/introduction/overview/),
[Uptime Kuma](https://github.com/louislam/uptime-kuma).

## Практика на уже работающем проекте

1. Linux: SSH-ключи, пользователи/права, процессы, переменные окружения, дисковое место, логи,
   listening ports и firewall. Уметь выяснить, почему процесс не запускается.
2. Собрать production-образ: фиксированная база/lockfile, multi-stage где полезно, non-root
   процесс, минимальные зависимости, секреты вне image.
3. Compose: API/worker/PostgreSQL/Redis и reverse proxy, внутренние сети и volumes.
   Наружу публикуются необходимые порты; БД и Redis не становятся публичными сервисами.
4. Домен → DNS → Caddy → HTTPS → приложение. Разобрать forwarded headers, доверенный proxy,
   ограничения размера и времени HTTP-запроса.
5. CI: установка из lockfile, lint/typecheck, тесты с одноразовой БД, сборка image.
   Затем контролируемый выпуск конкретного image tag и smoke-проверка.
6. Миграции выполнять отдельным шагом выпуска, а не одновременно из каждого API-процесса.
   На учебном изменении пройти expand → совместимый код → перенос данных → contract.
7. Проверить rollback приложения при совместимой схеме. Откат image не восстанавливает удалённые
   данные; разрушительную миграцию нельзя считать автоматически обратимой.
8. Записать backup/restore-процедуру: отдельное хранилище, доступ, периодичность, срок хранения,
   RPO/RTO простыми словами. Восстановить backup в новую БД и проверить прикладные записи.
9. Настроить логи, uptime, ошибки, latency, длину/возраст очереди, диск и число соединений БД.
   Для одного проекта достаточно небольшого набора метрик и одного полезного уведомления.
10. Описать runbook: недоступен API; недоступна БД; worker завис; закончился диск;
    не проходит webhook; нужно отозвать утёкший токен.
    - Для каждого сценария: симптом, где смотреть, первое безопасное действие, как проверить
      восстановление.

## Эксперименты

1. **Перезапустить хост или контейнер.** Сервисы поднимаются сами, данные на месте.
2. **Оборвать БД.** API отвечает понятной ошибкой, readiness меняется, после возврата БД
   работа восстанавливается без ручного перезапуска.
3. **Выпустить несовместимую настройку в тестовой среде.** Запуск останавливается на проверке
   конфигурации, откат к прошлому тегу возвращает работу.
4. **Выполнить восстановление и измерить время.** Результат сравнить с записанным RTO.

## Критерии выхода

- Другой человек может запустить проект по README.
- Находишь причину сбоя по наблюдениям.
- Выкатываешь известную версию.
- Подтверждаешь восстановление данных.

## Типичные ошибки

- Порты PostgreSQL или Redis опубликованы в интернет.
- Миграции запускаются при старте каждого экземпляра API.
- Секреты в образе или в git.
- Деплой тега `latest` без возможности вернуть прошлую версию.
- Backup, который ни разу не восстанавливали.
- Уведомления на всё подряд, которые перестают читать.

## Что записать как доказательство

Ссылка на CI-запуск и выпущенный тег, runbook, протокол restore с измеренным временем,
скриншот или выгрузка метрик и одного сработавшего уведомления.

Читать: [Docker Compose в production](https://docs.docker.com/compose/how-tos/production/),
[Caddy HTTPS](https://caddyserver.com/docs/automatic-https).
