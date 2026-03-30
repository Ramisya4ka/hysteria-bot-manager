import type Database from "better-sqlite3";
import type { ServerSettings } from "../types/models";

function mapRow(row: Record<string, unknown>): ServerSettings {
  return {
    domain: String(row.domain),
    port: Number(row.port),
    certPath: String(row.cert_path),
    keyPath: String(row.key_path),
    masqueradeUrl: row.masquerade_url === null ? null : String(row.masquerade_url),
    udpIdleTimeout: row.udp_idle_timeout === null ? null : String(row.udp_idle_timeout),
    obfsType: row.obfs_type === null ? null : String(row.obfs_type),
    obfsPassword: row.obfs_password === null ? null : String(row.obfs_password),
    serviceName: String(row.service_name),
    configPath: String(row.config_path),
  };
}

export class SettingsRepository {
  constructor(private readonly db: Database.Database) {}

  get(): ServerSettings | null {
    const row = this.db.prepare("SELECT * FROM server_settings WHERE id = 1").get() as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : null;
  }

  upsert(input: ServerSettings): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO server_settings
          (id, domain, port, cert_path, key_path, masquerade_url, udp_idle_timeout, obfs_type, obfs_password, service_name, config_path, created_at, updated_at)
         VALUES
          (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          domain = excluded.domain,
          port = excluded.port,
          cert_path = excluded.cert_path,
          key_path = excluded.key_path,
          masquerade_url = excluded.masquerade_url,
          udp_idle_timeout = excluded.udp_idle_timeout,
          obfs_type = excluded.obfs_type,
          obfs_password = excluded.obfs_password,
          service_name = excluded.service_name,
          config_path = excluded.config_path,
          updated_at = excluded.updated_at`,
      )
      .run(
        input.domain,
        input.port,
        input.certPath,
        input.keyPath,
        input.masqueradeUrl,
        input.udpIdleTimeout,
        input.obfsType,
        input.obfsPassword,
        input.serviceName,
        input.configPath,
        now,
        now,
      );
  }
}
