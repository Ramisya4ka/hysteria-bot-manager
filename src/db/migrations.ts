import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hysteria_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      note TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      domain TEXT NOT NULL,
      port INTEGER NOT NULL,
      cert_path TEXT NOT NULL,
      key_path TEXT NOT NULL,
      masquerade_url TEXT,
      udp_idle_timeout TEXT,
      obfs_type TEXT,
      obfs_password TEXT,
      service_name TEXT NOT NULL,
      config_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      admin_telegram_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      success INTEGER NOT NULL,
      message TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_by_telegram_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );
  `);
}
