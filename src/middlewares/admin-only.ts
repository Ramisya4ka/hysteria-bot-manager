import type { MiddlewareFn } from "grammy";
import type { BotContext } from "../types/context";

export function adminOnly(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    if (!ctx.services.authz.isAllowedTelegramId(ctx.from?.id)) {
      return;
    }

    await next();
  };
}
