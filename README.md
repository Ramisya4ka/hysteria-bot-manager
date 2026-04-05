# Hysteria Bot

Telegram-бот для управления Hysteria 2 с моделью `deny by default`.

Проект рассчитан на такую схему:

- бот работает в Docker-контейнере
- SQLite хранится на хосте в bind mount
- host-side relay работает через `systemd`
- relay вызывает ограниченный helper на хосте
- helper генерирует YAML, делает backup, сохраняет права файла и перезапускает `hysteria-server`

## Что умеет

- `/status`
- `/users`
- пошаговое добавление пользователя
- enable / disable пользователя
- удаление пользователя с подтверждением
- генерация `hy2://` URI
- генерация QR-кода для `hy2://` URI
- `/logs`
- `/restart` с подтверждением
- `/apply` с подтверждением
- `/settings`

## Security model

- доступ только по allowlist `ADMIN_TELEGRAM_IDS`
- админ-команды только в `private chat`
- в группах админские действия не выполняются
- dangerous actions требуют подтверждения
- все действия пишутся в `audit_logs`
- бот не вызывает `systemctl` и `journalctl` напрямую
- host-side действия изолированы в relay/helper
- контейнер запускается с `read_only: true` и `no-new-privileges`

## Архитектура

- `src/`:
  bot, handlers, middleware, SQLite layer, services
- `scripts/hysteria-admin-helper.mjs`:
  host-side helper, который читает SQLite, генерирует YAML, делает backup и рестарт сервиса
- `scripts/hysteria-admin-relay.mjs`:
  host-side relay, который принимает команды от контейнера через Unix socket
- `scripts/import-live-config.mjs`:
  импортирует существующий живой `/etc/hysteria/config.yaml` в SQLite без удаления пользователей
- `systemd/hysteria-bot-relay.service`:
  unit для host-side relay
- `docker-compose.yml`:
  запуск контейнера бота

## Требования

На хосте должны быть:

- Docker + Docker Compose
- Node.js
- npm
- sqlite3
- установленный Hysteria 2
- `systemd`
- `journalctl`

Проверка:

```bash
docker --version
docker compose version
node --version
npm --version
sqlite3 --version
which hysteria
systemctl cat hysteria-server
```

## Структура deployment

Рекомендуемый путь проекта:

```bash
/opt/bots-project/hysteria-bot
```

Пример каталогов:

```bash
/opt/bots-project/hysteria-bot/
  data/      # SQLite
  run/       # Unix socket relay
  scripts/
  src/
  systemd/
  .env
  docker-compose.yml
```

## Быстрый старт

Минимальный поток установки теперь такой:

```bash
cd /opt/bots-project
git clone https://github.com/Ramisya4ka/hysteria-bot-manager.git
cd /opt/bots-project/hysteria-bot
cp .env.example .env
nano .env
bash scripts/install-host.sh
bash scripts/sync-live-config.sh --domain your-domain.example
bash scripts/check.sh
```

## Важное предупреждение

Если на сервере уже есть рабочий `Hysteria 2`, то перед первым использованием бота:

1. сделай backup текущего `/etc/hysteria/config.yaml`
2. обязательно синхронизируй live config в SQLite через `scripts/sync-live-config.sh`
3. не нажимай `apply`, `add user`, `delete user` и другие действия, меняющие конфиг, пока синхронизация не выполнена

Пример backup:

```bash
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.manual-backup.$(date +%F-%H%M%S)
```

Почему это важно:

- бот и helper после синхронизации работают от SQLite
- если пропустить импорт live config, SQLite может не совпадать с реальным рабочим YAML
- в таком случае первый `apply` может перезаписать живой конфиг неполными или устаревшими данными

Рекомендуемый безопасный порядок:

```bash
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.manual-backup.$(date +%F-%H%M%S)
bash scripts/install-host.sh
bash scripts/sync-live-config.sh --domain your-domain.example
bash scripts/check.sh
```

После этого можно идти в Telegram и проверять:

- `/start`
- `/status`
- `/settings`
- `/users`
- `/logs`

## Установка

### 1. Клонирование / копирование проекта

```bash
cd /opt/bots-project
git clone https://github.com/Ramisya4ka/hysteria-bot-manager.git
cd /opt/bots-project/hysteria-bot
```

Если проект уже скопирован вручную, просто перейди в каталог:

```bash
cd /opt/bots-project/hysteria-bot
```

### 2. Подготовка каталогов

```bash
mkdir -p /opt/bots-project/hysteria-bot/data
mkdir -p /opt/bots-project/hysteria-bot/run
chmod 755 /opt/bots-project/hysteria-bot/data
chmod 755 /opt/bots-project/hysteria-bot/run
```

### 3. Установка зависимостей на хосте

Host-side helper использует `node_modules` проекта, поэтому их нужно собрать на Linux-хосте:

```bash
cd /opt/bots-project/hysteria-bot
rm -rf node_modules
npm ci
```

То же самое делает [scripts/install-host.sh]

### 4. Создание `.env`

```bash
cp .env.example .env
```

Пример рабочего `.env` для Docker + relay:

```env
BOT_TOKEN=PASTE_YOUR_BOT_TOKEN_HERE
ADMIN_TELEGRAM_IDS=123456789

DATABASE_PATH=/app/data/hysteria-bot.sqlite

HOST_HELPER_MODE=unix-http
HOST_HELPER_PATH=/opt/bots-project/hysteria-bot/scripts/hysteria-admin-helper
HOST_HELPER_SOCKET_PATH=/var/run/hysteria-bot/helper.sock

HYSTERIA_CONFIG_OUTPUT_PATH=/etc/hysteria/config.yaml
HYSTERIA_VALIDATOR_BIN=/usr/local/bin/hysteria
HYSTERIA_SERVICE_NAME=hysteria-server

DEFAULT_LOG_LINES=30
CONFIRMATION_TTL_SECONDS=180
```

Примечания:

- `BOT_TOKEN`: токен Telegram-бота
- `ADMIN_TELEGRAM_IDS`: numeric Telegram user ID через запятую
- `DATABASE_PATH=/app/data/...`: путь внутри контейнера
- `HOST_HELPER_MODE=unix-http`: контейнер работает через relay
- `HYSTERIA_VALIDATOR_BIN`: подставь реальный путь к `hysteria` на хосте

### 5. Проверка helper-файлов

```bash
chmod 755 scripts/hysteria-admin-helper
chmod 755 scripts/hysteria-admin-helper.mjs
chmod 755 scripts/hysteria-admin-relay.mjs
chmod 755 scripts/import-live-config.mjs
```

Это тоже делает `scripts/install-host.sh`.

## Host relay

### 1. Установка unit

```bash
cp /opt/bots-project/hysteria-bot/systemd/hysteria-bot-relay.service /etc/systemd/system/hysteria-bot-relay.service
systemctl daemon-reload
systemctl enable --now hysteria-bot-relay
```

Это тоже делает `scripts/install-host.sh`.

### 2. Проверка relay

```bash
systemctl status hysteria-bot-relay --no-pager
echo '---'
ls -la /opt/bots-project/hysteria-bot/run
echo '---'
journalctl -u hysteria-bot-relay -n 50 --no-pager
```

В `run/` должен появиться `helper.sock`.

## Docker запуск

Собрать и поднять контейнер:

```bash
cd /opt/bots-project/hysteria-bot
docker compose build
docker compose up -d
docker compose ps
docker compose logs -n 100
```

Это тоже делает `scripts/install-host.sh`.

Если SQLite не создаётся из-за прав, временно можно:

```bash
chmod 777 /opt/bots-project/hysteria-bot/data
docker compose restart
```

## Важный момент про путь к SQLite

Контейнер видит базу как:

```bash
/app/data/hysteria-bot.sqlite
```

Host-side helper работает на хосте, поэтому для него этот путь тоже должен существовать. Простой практический способ:

```bash
mkdir -p /app
rm -rf /app/data
ln -s /opt/bots-project/hysteria-bot/data /app/data
```

Проверка:

```bash
ls -la /app
ls -la /app/data
```

## Первичная инициализация SQLite

После первого запуска контейнера должна появиться база:

```bash
ls -la /opt/bots-project/hysteria-bot/data
sqlite3 /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite ".tables"
```

Ожидаемые таблицы:

- `hysteria_users`
- `server_settings`
- `audit_logs`
- `pending_confirmations`

## Если Hysteria уже работает на сервере

Если у тебя уже есть живой `/etc/hysteria/config.yaml`, сначала синхронизируй его в SQLite, а уже потом пользуйся `apply` через бота.

### Импорт существующего live config

```bash
cd /opt/bots-project/hysteria-bot
node /opt/bots-project/hysteria-bot/scripts/import-live-config.mjs \
  --db /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite \
  --config /etc/hysteria/config.yaml \
  --service hysteria-server
```

Упрощённый вариант:

```bash
bash scripts/sync-live-config.sh --domain your-domain.example
```

### Зачем это нужно

Без импорта бот может перезаписать рабочий YAML неполными данными из SQLite.  
Импорт:

- подтянет существующих пользователей
- подтянет `port`
- подтянет `tls cert/key`
- подтянет `masquerade`
- подтянет `udpIdleTimeout`
- не удалит существующих пользователей

### Отдельно задать `domain` для URI

Даже если в YAML нет явного domain, боту он нужен для генерации `hy2://`.

Пример:

```bash
sqlite3 /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite \
  "update server_settings set domain='example.com', updated_at=datetime('now') where id=1;"
```

Это тоже делает `scripts/sync-live-config.sh`.

### Проверка импорта

```bash
sqlite3 /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite \
  "select username,enabled from hysteria_users order by username;"

echo '---'

sqlite3 /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite \
  "select domain,port,cert_path,key_path,masquerade_url,udp_idle_timeout from server_settings;"
```

## Проверка helper вручную

Перед тестом через Telegram полезно проверить helper напрямую:

```bash
/opt/bots-project/hysteria-bot/scripts/hysteria-admin-helper status \
  --db /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite \
  --service hysteria-server
```

```bash
/opt/bots-project/hysteria-bot/scripts/hysteria-admin-helper logs \
  --service hysteria-server \
  --lines 20
```

Если обе команды работают, значит host-side контур в порядке.

## Проверка Hysteria после apply

После любого `apply` или добавления пользователя проверь:

```bash
cat /etc/hysteria/config.yaml
echo '---'
ls -l /etc/hysteria/config.yaml
echo '---'
systemctl status hysteria-server --no-pager
echo '---'
journalctl -u hysteria-server -n 50 --no-pager
```

Если сервис читает конфиг без проблем, права на `config.yaml` в порядке.

## Telegram flow

### Базовый smoke test

В личном чате с ботом:

- `/start`
- `/status`
- `/settings`
- `/users`
- `/logs`

### Проверка безопасности

Проверь, что:

- бот работает только для allowlisted user ID
- в группе бот не выполняет админские действия
- `delete`, `restart`, `apply` требуют confirm

### Add user

Пошаговый flow:

1. username
2. password
3. note
4. `yes/no` для enabled

Поле `note`:

- это просто внутренняя заметка
- на Hysteria не влияет
- если заметка не нужна, отправь `-`

После успешного добавления бот должен:

- сообщить, что пользователь создан
- применить конфиг
- прислать URI

### QR-код настроек

В списке пользователей рядом с `URI` есть кнопка `QR`.

Что она делает:

- генерирует QR-код из `hy2://` URI
- отправляет PNG в Telegram только allowlisted админу
- не пишет сам URI или пароль в audit log

Это удобно для быстрого подключения клиента с телефона.

## Audit log

Проверка последних действий:

```bash
sqlite3 /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite \
  "select id,timestamp,admin_telegram_id,action,success,message from audit_logs order by id desc limit 30;"
```

## Обновление проекта

Обычное обновление кода и перезапуск контейнера **не должны удалять пользователей**, если каталог `data/` сохранён.

Почему:

- пользователи и настройки хранятся в SQLite
- SQLite лежит в bind mount `./data`
- `docker compose build` и `docker compose up -d` пересобирают контейнер, но не стирают `./data`

Безопасный порядок обновления:

```bash
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.manual-backup.$(date +%F-%H%M%S)
cd /opt/bots-project/hysteria-bot
npm ci
docker compose build
docker compose up -d
```

После обновления полезно проверить:

```bash
sqlite3 /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite "select username,enabled from hysteria_users order by username;"
echo '---'
cd /opt/bots-project/hysteria-bot && docker compose logs --since=2m
```

Когда пользователи могут потеряться:

- если удалить каталог `data/`
- если заменить или повредить файл SQLite
- если пропустить backup и вручную перетереть live config, а потом синхронизировать неверные данные обратно

## Полезные команды

### Готовые служебные скрипты

Установить инфраструктуру:

```bash
bash scripts/install-host.sh
```

Синхронизировать живой Hysteria config в SQLite:

```bash
bash scripts/sync-live-config.sh --domain your-domain.example
```

Проверить состояние после установки:

```bash
bash scripts/check.sh
```

### Логи контейнера

```bash
cd /opt/bots-project/hysteria-bot
docker compose logs -n 100
```

Только свежие:

```bash
cd /opt/bots-project/hysteria-bot
docker compose logs --since=2m
```

Live:

```bash
cd /opt/bots-project/hysteria-bot
docker compose logs -f
```

### Relay

```bash
systemctl status hysteria-bot-relay --no-pager
journalctl -u hysteria-bot-relay -n 100 --no-pager
```

### Hysteria

```bash
systemctl restart hysteria-server
systemctl status hysteria-server --no-pager
journalctl -u hysteria-server -n 50 --no-pager
```

### SQLite

```bash
sqlite3 /opt/bots-project/hysteria-bot/data/hysteria-bot.sqlite ".tables"
```

## Типичные проблемы

### `SQLITE_CANTOPEN`

Обычно проблема прав на `data/`.

Проверь:

```bash
ls -la /opt/bots-project/hysteria-bot/data
chmod 777 /opt/bots-project/hysteria-bot/data
docker compose restart
```

### `connect EACCES /var/run/hysteria-bot/helper.sock`

Проблема прав на Unix socket relay.

Проверь:

```bash
ls -la /opt/bots-project/hysteria-bot/run
systemctl restart hysteria-bot-relay
```

### `SQLite database not found: /app/data/...`

Host helper не видит путь контейнера.  
Нужен symlink:

```bash
mkdir -p /app
rm -rf /app/data
ln -s /opt/bots-project/hysteria-bot/data /app/data
```

### `invalid ELF header` у `better-sqlite3`

`node_modules` собраны не под Linux.  
Пересобери зависимости на сервере:

```bash
cd /opt/bots-project/hysteria-bot
rm -rf node_modules
npm ci
```

### `unknown flag: --test`

Твоя версия `hysteria` не поддерживает `--test`.  
Используй актуальный `scripts/hysteria-admin-helper.mjs` из этого репозитория.

### `open /etc/hysteria/config.yaml: permission denied`

После `apply` проверь права:

```bash
ls -l /etc/hysteria/config.yaml
```

Рабочий минимум:

```bash
chmod 644 /etc/hysteria/config.yaml
systemctl restart hysteria-server
```

Более аккуратно:

```bash
chown root:hysteria /etc/hysteria/config.yaml
chmod 640 /etc/hysteria/config.yaml
systemctl restart hysteria-server
```
