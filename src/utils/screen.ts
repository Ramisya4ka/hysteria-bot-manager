import type { InlineKeyboard } from "grammy";
import type { BotContext } from "../types/context";

export async function renderScreen(
  ctx: BotContext,
  text: string,
  keyboard: InlineKeyboard,
): Promise<void> {
  const targetMessageId = ctx.session.ui.screenMessageId;

  if (ctx.callbackQuery?.message?.message_id) {
    try {
      await ctx.editMessageText(text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("message is not modified")) {
        return;
      }
      throw error;
    }
    ctx.session.ui.screenMessageId = ctx.callbackQuery.message.message_id;
    return;
  }

  if (targetMessageId) {
    try {
      await ctx.api.editMessageText(ctx.chat!.id, targetMessageId, text, {
        reply_markup: keyboard,
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.message.includes("message is not modified")) {
        return;
      }
      // Fall through and create a new screen message if the old one is gone.
    }
  }

  const sent = await ctx.reply(text, {
    reply_markup: keyboard,
  });
  ctx.session.ui.screenMessageId = sent.message_id;
}
