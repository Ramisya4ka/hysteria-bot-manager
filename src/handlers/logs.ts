import type { Bot } from "grammy";
import type { BotContext } from "../types/context";
import { screenNavKeyboard } from "../utils/keyboards";
import { renderScreen } from "../utils/screen";

export function registerLogsHandler(bot: Bot<BotContext>): void {
  const render = async (ctx: BotContext): Promise<void> => {
    const logs = await ctx.services.hysteriaService.getLogs(ctx.services.env.DEFAULT_LOG_LINES);
    const safeLogs = logs.length > 3500 ? logs.slice(-3500) : logs;
    await renderScreen(ctx, `Recent Logs\n\n${safeLogs || "(empty)"}`, screenNavKeyboard());
    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action: "logs",
      success: true,
    });
  };

  bot.command("logs", render);
  bot.callbackQuery("menu:logs", async (ctx) => {
    await ctx.answerCallbackQuery();
    await render(ctx);
  });
}
