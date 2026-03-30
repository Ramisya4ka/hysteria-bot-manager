import { ConfirmationRepository } from "../repositories/confirmation.repository";
import type { AuditRepository } from "../repositories/audit.repository";
import type { SettingsRepository } from "../repositories/settings.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { Env } from "../config/env";
import { AuditService } from "../services/audit.service";
import { AuthzService } from "../services/authz.service";
import { HysteriaConfigService } from "../services/hysteria-config.service";
import { HysteriaService } from "../services/hysteria-service.service";
import { UriService } from "../services/uri.service";

export interface ServiceContainer {
  env: Env;
  authz: AuthzService;
  audit: AuditService;
  users: UserRepository;
  settings: SettingsRepository;
  confirmations: ConfirmationRepository;
  uri: UriService;
  hysteriaConfig: HysteriaConfigService;
  hysteriaService: HysteriaService;
  auditRepository: AuditRepository;
}
