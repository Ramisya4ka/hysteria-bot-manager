#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$PROJECT_DIR/data/hysteria-bot.sqlite"
CONFIG_PATH="/etc/hysteria/config.yaml"
SERVICE_NAME="hysteria-server"
DOMAIN=""

usage() {
  echo "Usage: $0 --domain example.com [--config /etc/hysteria/config.yaml] [--service hysteria-server]" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --config)
      CONFIG_PATH="${2:-}"
      shift 2
      ;;
    --service)
      SERVICE_NAME="${2:-}"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  usage
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "SQLite database not found: $DB_PATH" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Hysteria config not found: $CONFIG_PATH" >&2
  exit 1
fi

node "$PROJECT_DIR/scripts/import-live-config.mjs" \
  --db "$DB_PATH" \
  --config "$CONFIG_PATH" \
  --service "$SERVICE_NAME"

sqlite3 "$DB_PATH" "update server_settings set domain='${DOMAIN}', updated_at=datetime('now') where id=1;"

echo "SQLite synced from live config."
echo "Users:"
sqlite3 "$DB_PATH" "select username,enabled from hysteria_users order by username;"
echo "---"
echo "Server settings:"
sqlite3 "$DB_PATH" "select domain,port,cert_path,key_path,masquerade_url,udp_idle_timeout from server_settings;"
