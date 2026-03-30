export interface HysteriaUser {
  id: number;
  username: string;
  password: string;
  note: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerSettings {
  domain: string;
  port: number;
  certPath: string;
  keyPath: string;
  masqueradeUrl: string | null;
  udpIdleTimeout: string | null;
  obfsType: string | null;
  obfsPassword: string | null;
  serviceName: string;
  configPath: string;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  adminTelegramId: string;
  action: string;
  payload: string | null;
  success: boolean;
  message: string | null;
}

export interface PendingConfirmation {
  id: number;
  token: string;
  action: string;
  payload: string;
  createdByTelegramId: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}
