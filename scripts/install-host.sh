#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"
RUN_DIR="$PROJECT_DIR/run"
ENV_FILE="$PROJECT_DIR/.env"
UNIT_SRC="$PROJECT_DIR/systemd/hysteria-bot-relay.service"
UNIT_DST="/etc/systemd/system/hysteria-bot-relay.service"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

require_cmd docker
require_cmd npm
require_cmd node
require_cmd sqlite3
require_cmd systemctl

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env not found at $ENV_FILE" >&2
  echo "Create it from .env.example before running install-host.sh" >&2
  exit 1
fi

mkdir -p "$DATA_DIR" "$RUN_DIR"
chmod 755 "$DATA_DIR" "$RUN_DIR"

cd "$PROJECT_DIR"
rm -rf node_modules
npm ci

chmod 755 "$PROJECT_DIR/scripts/hysteria-admin-helper"
chmod 755 "$PROJECT_DIR/scripts/hysteria-admin-helper.mjs"
chmod 755 "$PROJECT_DIR/scripts/hysteria-admin-relay.mjs"
chmod 755 "$PROJECT_DIR/scripts/import-live-config.mjs"

cp "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload
systemctl enable --now hysteria-bot-relay

mkdir -p /app
rm -rf /app/data
ln -s "$DATA_DIR" /app/data

docker compose build
docker compose up -d

echo "Install completed."
echo "Next:"
echo "1. Verify relay with: systemctl status hysteria-bot-relay --no-pager"
echo "2. Sync live config with: $PROJECT_DIR/scripts/sync-live-config.sh --domain YOUR_DOMAIN"
echo "3. Run checks with: $PROJECT_DIR/scripts/check.sh"
