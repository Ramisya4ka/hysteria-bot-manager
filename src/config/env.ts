import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  ADMIN_TELEGRAM_IDS: z.string().min(1),
  DATABASE_PATH: z.string().min(1).default("./data/hysteria-bot.sqlite"),
  HOST_HELPER_MODE: z.enum(["exec", "unix-http"]).default("exec"),
  HOST_HELPER_PATH: z.string().min(1),
  HOST_HELPER_SOCKET_PATH: z.string().min(1).default("/var/run/hysteria-bot/helper.sock"),
  HYSTERIA_CONFIG_OUTPUT_PATH: z.string().min(1).default("/etc/hysteria/config.yaml"),
  HYSTERIA_VALIDATOR_BIN: z.string().min(1).default("/usr/bin/hysteria"),
  HYSTERIA_SERVICE_NAME: z.string().min(1).default("hysteria-server"),
  DEFAULT_LOG_LINES: z.coerce.number().int().positive().max(200).default(30),
  CONFIRMATION_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(180),
});

export type Env = z.infer<typeof envSchema> & {
  adminTelegramIds: Set<number>;
  databasePathAbsolute: string;
};

export function loadEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.parse(rawEnv);
  const adminTelegramIds = new Set(
    parsed.ADMIN_TELEGRAM_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value)),
  );

  if (adminTelegramIds.size === 0) {
    throw new Error("ADMIN_TELEGRAM_IDS must contain at least one numeric Telegram ID");
  }

  return {
    ...parsed,
    adminTelegramIds,
    databasePathAbsolute: path.resolve(parsed.DATABASE_PATH),
  };
}
