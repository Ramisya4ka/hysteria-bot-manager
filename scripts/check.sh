#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$PROJECT_DIR/data/hysteria-bot.sqlite"

echo "Relay status"
systemctl status hysteria-bot-relay --no-pager
echo "---"

echo "Relay socket"
ls -la "$PROJECT_DIR/run"
echo "---"

echo "Docker status"
cd "$PROJECT_DIR"
docker compose ps
echo "---"

echo "Recent bot logs"
docker compose logs --since=2m || true
echo "---"

echo "SQLite tables"
sqlite3 "$DB_PATH" ".tables"
echo "---"

echo "Helper status"
"$PROJECT_DIR/scripts/hysteria-admin-helper" status --db "$DB_PATH" --service hysteria-server
echo "---"

echo "Helper logs"
"$PROJECT_DIR/scripts/hysteria-admin-helper" logs --service hysteria-server --lines 10
