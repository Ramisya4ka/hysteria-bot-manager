import type { MiddlewareFn } from "grammy";
import type { BotContext } from "../types/context";

export function privateChatOnly(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      if (ctx.from && ctx.services.authz.isAllowedTelegramId(ctx.from.id) && ctx.msg?.text?.startsWith("/")) {
        await ctx.reply("Доступно только в личном чате.");
      }
      return;
    }

    await next();
  };
}
