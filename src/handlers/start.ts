import type { Bot } from "grammy";
import type { BotContext } from "../types/context";
import { mainMenuKeyboard } from "../utils/keyboards";
import { renderScreen } from "../utils/screen";

async function renderHome(ctx: BotContext): Promise<void> {
  const settings = ctx.services.settings.get();
  let summary = "Settings not initialized.";

  try {
    const status = await ctx.services.hysteriaService.status();
    summary = [
      "Hysteria 2 Admin",
      "",
      `State: ${status.state}`,
      `Users: ${status.usersCount}`,
      `Domain: ${status.domain}`,
      `Port: ${status.port}`,
      `Obfs: ${status.obfsEnabled ? "on" : "off"}`,
    ].join("\n");
  } catch {
    if (settings) {
      summary = [
        "Hysteria 2 Admin",
        "",
        "State: unknown",
        `Domain: ${settings.domain}`,
        `Port: ${settings.port}`,
      ].join("\n");
    }
  }

  await renderScreen(ctx, summary, mainMenuKeyboard());
}

export function registerStartHandler(bot: Bot<BotContext>): void {
  bot.command("start", async (ctx) => {
    await renderHome(ctx);

    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action: "start",
      success: true,
    });
  });

  bot.callbackQuery("menu:home", async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderHome(ctx);
  });
}
