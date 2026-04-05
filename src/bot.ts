import { Bot, session } from "grammy";
import { registerActionsHandler } from "./handlers/actions";
import { registerLogsHandler } from "./handlers/logs";
import { registerSettingsHandler } from "./handlers/settings";
import { registerStartHandler } from "./handlers/start";
import { registerStatusHandler } from "./handlers/status";
import { registerUsersHandler } from "./handlers/users";
import { adminOnly } from "./middlewares/admin-only";
import { auditErrors } from "./middlewares/audit";
import { privateChatOnly } from "./middlewares/private-chat-only";
import type { BotContext } from "./types/context";
import { initialSessionData } from "./types/session";
import type { ServiceContainer } from "./utils/service-container";
import { mainMenuKeyboard } from "./utils/keyboards";
import { renderScreen } from "./utils/screen";

export function createBot(services: ServiceContainer): Bot<BotContext> {
  const bot = new Bot<BotContext>(services.env.BOT_TOKEN);

  bot.catch(async (error) => {
    console.error(error);

    const ctx = error.ctx;
    if (ctx.from?.id && services.authz.isAllowedTelegramId(ctx.from.id)) {
      services.audit.log({
        adminTelegramId: String(ctx.from.id),
        action: "bot_catch",
        payload: { updateId: ctx.update.update_id },
        success: false,
        message: error.error instanceof Error ? error.error.message : "Unknown bot error",
      });

      try {
        await ctx.reply("Operation failed. Check relay/helper logs and try again.");
      } catch {
        // Ignore secondary reply failures in the global error handler.
      }
    }
  });

  bot.use(async (ctx, next) => {
    ctx.services = services;
    await next();
  });
  bot.use(session({ initial: initialSessionData }));
  bot.use(auditErrors());
  bot.use(adminOnly());
  bot.use(privateChatOnly());

  registerStartHandler(bot);
  registerStatusHandler(bot);
  registerUsersHandler(bot);
  registerLogsHandler(bot);
  registerSettingsHandler(bot);
  registerActionsHandler(bot);

  bot.command("menu", async (ctx) => {
    await renderScreen(ctx, "Hysteria 2 Admin", mainMenuKeyboard());
  });

  return bot;
}
