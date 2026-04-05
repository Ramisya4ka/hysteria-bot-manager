import type { Bot } from "grammy";
import type { BotContext } from "../types/context";
import { screenNavKeyboard } from "../utils/keyboards";
import { renderScreen } from "../utils/screen";

function formatSettings(ctx: BotContext): string {
  const settings = ctx.services.settings.get();
  if (!settings) {
    return "Server settings are not initialized.";
  }

  return [
    `Domain: ${settings.domain}`,
    `Port: ${settings.port}`,
    `Cert: ${settings.certPath}`,
    `Key: ${settings.keyPath}`,
    `Masquerade: ${settings.masqueradeUrl ?? "-"}`,
    `udpIdleTimeout: ${settings.udpIdleTimeout ?? "-"}`,
    `Obfs: ${settings.obfsType ?? "-"}`,
    `Config path: ${settings.configPath}`,
  ].join("\n");
}

export function registerSettingsHandler(bot: Bot<BotContext>): void {
  const render = async (ctx: BotContext): Promise<void> => {
    await renderScreen(ctx, `Server Settings\n\n${formatSettings(ctx)}`, screenNavKeyboard());
    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action: "settings",
      success: true,
    });
  };

  bot.command("settings", render);
  bot.callbackQuery("menu:settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    await render(ctx);
  });
}
