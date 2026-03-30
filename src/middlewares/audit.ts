import type { MiddlewareFn } from "grammy";
import type { BotContext } from "../types/context";

export function auditErrors(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      if (ctx.from?.id && ctx.services.authz.isAllowedTelegramId(ctx.from.id)) {
        ctx.services.audit.log({
          adminTelegramId: String(ctx.from.id),
          action: "handler_error",
          payload: { updateId: ctx.update.update_id },
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      throw error;
    }
  };
}
