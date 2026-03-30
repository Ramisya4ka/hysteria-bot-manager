import type Database from "better-sqlite3";
import type { HysteriaUser } from "../types/models";

function mapRow(row: Record<string, unknown>): HysteriaUser {
  return {
    id: Number(row.id),
    username: String(row.username),
    password: String(row.password),
    note: row.note === null ? null : String(row.note),
    enabled: Number(row.enabled) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  listAll(): HysteriaUser[] {
    const rows = this.db
      .prepare("SELECT * FROM hysteria_users ORDER BY username COLLATE NOCASE")
      .all() as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  countAll(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM hysteria_users").get() as { count: number };
    return row.count;
  }

  getById(id: number): HysteriaUser | null {
    const row = this.db.prepare("SELECT * FROM hysteria_users WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : null;
  }

  getByUsername(username: string): HysteriaUser | null {
    const row = this.db.prepare("SELECT * FROM hysteria_users WHERE username = ?").get(username) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : null;
  }

  create(input: { username: string; password: string; note: string | null; enabled: boolean }): HysteriaUser {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO hysteria_users (username, password, note, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(input.username, input.password, input.note, input.enabled ? 1 : 0, now, now);
    return this.getById(Number(result.lastInsertRowid)) as HysteriaUser;
  }

  updateEnabled(id: number, enabled: boolean): void {
    this.db
      .prepare("UPDATE hysteria_users SET enabled = ?, updated_at = ? WHERE id = ?")
      .run(enabled ? 1 : 0, new Date().toISOString(), id);
  }

  updatePassword(id: number, password: string): void {
    this.db
      .prepare("UPDATE hysteria_users SET password = ?, updated_at = ? WHERE id = ?")
      .run(password, new Date().toISOString(), id);
  }

  delete(id: number): void {
    this.db.prepare("DELETE FROM hysteria_users WHERE id = ?").run(id);
  }
}
