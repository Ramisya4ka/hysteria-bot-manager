import type { Bot } from "grammy";
import type { BotContext } from "../types/context";

export function registerLogsHandler(bot: Bot<BotContext>): void {
  const render = async (ctx: BotContext): Promise<void> => {
    const logs = await ctx.services.hysteriaService.getLogs(ctx.services.env.DEFAULT_LOG_LINES);
    const safeLogs = logs.length > 3500 ? logs.slice(-3500) : logs;
    await ctx.reply(`Recent logs:\n\n${safeLogs || "(empty)"}`);
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
