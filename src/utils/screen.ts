import { InputFile, type InlineKeyboard } from "grammy";
import type { BotContext } from "../types/context";

export async function renderScreen(
  ctx: BotContext,
  text: string,
  keyboard: InlineKeyboard,
): Promise<void> {
  const targetMessageId = ctx.session.ui.screenMessageId;
  const callbackMessage = ctx.callbackQuery?.message;

  if (callbackMessage?.message_id && "text" in callbackMessage) {
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
    ctx.session.ui.screenMessageId = callbackMessage.message_id;
    return;
  }

  if (callbackMessage?.message_id) {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, callbackMessage.message_id);
    } catch {
      // Ignore delete failures and continue by sending a new screen message.
    }
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

export async function renderPhotoScreen(
  ctx: BotContext,
  buffer: Buffer,
  filename: string,
  caption: string,
  keyboard: InlineKeyboard,
): Promise<void> {
  const targetMessageId = ctx.session.ui.screenMessageId;

  if (ctx.callbackQuery?.message?.message_id) {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, ctx.callbackQuery.message.message_id);
    } catch {
      // Ignore delete failures and continue with sending a fresh screen.
    }
  } else if (targetMessageId) {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, targetMessageId);
    } catch {
      // Ignore delete failures and continue with sending a fresh screen.
    }
  }

  const sent = await ctx.replyWithPhoto(new InputFile(buffer, filename), {
    caption,
    reply_markup: keyboard,
  });
  ctx.session.ui.screenMessageId = sent.message_id;
}
