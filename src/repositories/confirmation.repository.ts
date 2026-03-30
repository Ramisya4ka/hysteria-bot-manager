import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { PendingConfirmation } from "../types/models";

function mapRow(row: Record<string, unknown>): PendingConfirmation {
  return {
    id: Number(row.id),
    token: String(row.token),
    action: String(row.action),
    payload: String(row.payload),
    createdByTelegramId: String(row.created_by_telegram_id),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    consumedAt: row.consumed_at === null ? null : String(row.consumed_at),
  };
}

export class ConfirmationRepository {
  constructor(private readonly db: Database.Database) {}

  create(action: string, payload: string, createdByTelegramId: string, ttlSeconds: number): PendingConfirmation {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const token = crypto.randomBytes(16).toString("hex");
    this.db
      .prepare(
        `INSERT INTO pending_confirmations
          (token, action, payload, created_by_telegram_id, created_at, expires_at, consumed_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(token, action, payload, createdByTelegramId, now.toISOString(), expiresAt.toISOString());
    return this.getByToken(token) as PendingConfirmation;
  }

  getByToken(token: string): PendingConfirmation | null {
    const row = this.db.prepare("SELECT * FROM pending_confirmations WHERE token = ?").get(token) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : null;
  }

  consume(token: string): void {
    this.db
      .prepare("UPDATE pending_confirmations SET consumed_at = ? WHERE token = ?")
      .run(new Date().toISOString(), token);
  }

  pruneExpired(): void {
    this.db
      .prepare("DELETE FROM pending_confirmations WHERE expires_at < ? OR consumed_at IS NOT NULL")
      .run(new Date().toISOString());
  }
}
