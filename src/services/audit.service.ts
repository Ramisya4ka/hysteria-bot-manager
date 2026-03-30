import { AuditRepository } from "../repositories/audit.repository";

export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  log(input: {
    adminTelegramId: string;
    action: string;
    payload?: Record<string, unknown> | null;
    success: boolean;
    message?: string | null;
  }): void {
    this.auditRepository.insert({
      timestamp: new Date().toISOString(),
      adminTelegramId: input.adminTelegramId,
      action: input.action,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      success: input.success,
      message: input.message ?? null,
    });
  }
}
