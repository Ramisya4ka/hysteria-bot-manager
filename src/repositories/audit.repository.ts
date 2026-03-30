import type Database from "better-sqlite3";
import type { AuditLogEntry } from "../types/models";

export class AuditRepository {
  constructor(private readonly db: Database.Database) {}

  insert(entry: Omit<AuditLogEntry, "id">): void {
    this.db
      .prepare(
        `INSERT INTO audit_logs (timestamp, admin_telegram_id, action, payload, success, message)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.timestamp,
        entry.adminTelegramId,
        entry.action,
        entry.payload,
        entry.success ? 1 : 0,
        entry.message,
      );
  }

  latest(limit: number): AuditLogEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id),
      timestamp: String(row.timestamp),
      adminTelegramId: String(row.admin_telegram_id),
      action: String(row.action),
      payload: row.payload === null ? null : String(row.payload),
      success: Number(row.success) === 1,
      message: row.message === null ? null : String(row.message),
    }));
  }
}
