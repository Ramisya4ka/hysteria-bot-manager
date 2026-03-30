import type { Bot } from "grammy";
import type { BotContext } from "../types/context";
import { mainMenuKeyboard } from "../utils/keyboards";

export function registerStartHandler(bot: Bot<BotContext>): void {
  bot.command("start", async (ctx) => {
    await ctx.reply("Hysteria 2 admin bot", {
      reply_markup: mainMenuKeyboard(),
    });

    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action: "start",
      success: true,
    });
  });
}
