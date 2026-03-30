import type { Bot } from "grammy";
import type { BotContext } from "../types/context";

function formatStatus(status: {
  service: string;
  state: string;
  usersCount: number;
  domain: string;
  port: number;
  obfsEnabled: boolean;
}): string {
  return [
    `Service: ${status.service}`,
    `State: ${status.state}`,
    `Domain: ${status.domain}`,
    `Port: ${status.port}`,
    `Users: ${status.usersCount}`,
    `Obfs: ${status.obfsEnabled ? "on" : "off"}`,
  ].join("\n");
}

export function registerStatusHandler(bot: Bot<BotContext>): void {
  const render = async (ctx: BotContext): Promise<void> => {
    const status = await ctx.services.hysteriaService.status();
    await ctx.reply(formatStatus(status));
    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action: "status",
      success: true,
    });
  };

  bot.command("status", render);
  bot.callbackQuery("menu:status", async (ctx) => {
    await ctx.answerCallbackQuery();
    await render(ctx);
  });
}
