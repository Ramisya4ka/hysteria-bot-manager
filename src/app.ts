import process from "node:process";
import { createBot } from "./bot";
import { loadEnv } from "./config/env";
import { runMigrations } from "./db/migrations";
import { createSqliteConnection } from "./db/sqlite";
import { AuditRepository } from "./repositories/audit.repository";
import { ConfirmationRepository } from "./repositories/confirmation.repository";
import { SettingsRepository } from "./repositories/settings.repository";
import { UserRepository } from "./repositories/user.repository";
import { AuditService } from "./services/audit.service";
import { AuthzService } from "./services/authz.service";
import { HysteriaConfigService } from "./services/hysteria-config.service";
import { HysteriaService } from "./services/hysteria-service.service";
import { UriService } from "./services/uri.service";
import type { ServiceContainer } from "./utils/service-container";

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createSqliteConnection(env.databasePathAbsolute);
  runMigrations(db);

  const users = new UserRepository(db);
  const settings = new SettingsRepository(db);
  const auditRepository = new AuditRepository(db);
  const confirmations = new ConfirmationRepository(db);

  if (!settings.get()) {
    settings.upsert({
      domain: "example.com",
      port: 443,
      certPath: "/etc/letsencrypt/live/example.com/fullchain.pem",
      keyPath: "/etc/letsencrypt/live/example.com/privkey.pem",
      masqueradeUrl: "https://example.com",
      udpIdleTimeout: "60s",
      obfsType: null,
      obfsPassword: null,
      serviceName: env.HYSTERIA_SERVICE_NAME,
      configPath: env.HYSTERIA_CONFIG_OUTPUT_PATH,
    });
  }

  const services: ServiceContainer = {
    env,
    authz: new AuthzService(env.adminTelegramIds),
    audit: new AuditService(auditRepository),
    users,
    settings,
    confirmations,
    uri: new UriService(),
    hysteriaConfig: new HysteriaConfigService(users, settings),
    hysteriaService: new HysteriaService(env),
    auditRepository,
  };

  const bot = createBot(services);

  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());

  await bot.start({
    onStart: () => {
      console.log("Bot started");
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
