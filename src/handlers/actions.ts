import type { Bot } from "grammy";
import type { HysteriaUser } from "../types/models";
import type { BotContext } from "../types/context";
import { confirmationKeyboard } from "../utils/keyboards";

type ConfirmationPayload = { userId: number } | { type: "restart" } | { type: "apply" };

function payloadString(payload: ConfirmationPayload): string {
  return JSON.stringify(payload);
}

async function createConfirmation(
  ctx: BotContext,
  action: string,
  payload: ConfirmationPayload,
  prompt: string,
): Promise<void> {
  ctx.services.confirmations.pruneExpired();
  const confirmation = ctx.services.confirmations.create(
    action,
    payloadString(payload),
    String(ctx.from!.id),
    ctx.services.env.CONFIRMATION_TTL_SECONDS,
  );
  await ctx.reply(prompt, {
    reply_markup: confirmationKeyboard(confirmation.token),
  });
}

function restoreDeletedUser(ctx: BotContext, user: HysteriaUser): void {
  ctx.services.users.create({
    username: user.username,
    password: user.password,
    note: user.note,
    enabled: user.enabled,
  });
}

export function registerActionsHandler(bot: Bot<BotContext>): void {
  bot.command("restart", async (ctx) => {
    await createConfirmation(ctx, "restart-service", { type: "restart" }, "Confirm restart:");
  });

  bot.command("apply", async (ctx) => {
    await createConfirmation(ctx, "apply-config", { type: "apply" }, "Confirm config apply:");
  });

  bot.callbackQuery("menu:restart", async (ctx) => {
    await ctx.answerCallbackQuery();
    await createConfirmation(ctx, "restart-service", { type: "restart" }, "Confirm restart:");
  });

  bot.callbackQuery("menu:apply", async (ctx) => {
    await ctx.answerCallbackQuery();
    await createConfirmation(ctx, "apply-config", { type: "apply" }, "Confirm config apply:");
  });

  bot.callbackQuery(/^user:delete:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = Number(ctx.match[1]);
    const user = ctx.services.users.getById(userId);
    if (!user) {
      await ctx.reply("User not found.");
      return;
    }

    await createConfirmation(ctx, "delete-user", { userId }, `Confirm deletion of ${user.username}:`);
  });

  bot.callbackQuery(/^cancel:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Cancelled" });
    const token = ctx.match[1];
    const confirmation = ctx.services.confirmations.getByToken(token);
    if (confirmation) {
      ctx.services.confirmations.consume(token);
    }
    await ctx.reply("Action cancelled.");
  });

  bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const token = ctx.match[1];
    const confirmation = ctx.services.confirmations.getByToken(token);

    if (!confirmation || confirmation.consumedAt) {
      await ctx.reply("Confirmation not found or already used.");
      return;
    }

    if (confirmation.createdByTelegramId !== String(ctx.from!.id)) {
      await ctx.reply("Confirmation belongs to another admin.");
      return;
    }

    if (new Date(confirmation.expiresAt).getTime() < Date.now()) {
      ctx.services.confirmations.consume(token);
      await ctx.reply("Confirmation expired.");
      return;
    }

    const payload = JSON.parse(confirmation.payload) as ConfirmationPayload;

    try {
      if (confirmation.action === "delete-user") {
        const userId = Number((payload as { userId: number }).userId);
        const user = ctx.services.users.getById(userId);
        if (!user) {
          throw new Error("User not found");
        }

        ctx.services.users.delete(userId);
        try {
          await ctx.services.hysteriaService.applyConfig();
        } catch (error) {
          if (!ctx.services.users.getByUsername(user.username)) {
            restoreDeletedUser(ctx, user);
          }
          throw error;
        }

        await ctx.reply(`User ${user.username} deleted.`);
        ctx.services.audit.log({
          adminTelegramId: String(ctx.from!.id),
          action: "user_delete",
          payload: { userId, username: user.username },
          success: true,
        });
      } else if (confirmation.action === "restart-service") {
        const output = await ctx.services.hysteriaService.restartService();
        await ctx.reply(`Restart requested.\n${output}`);
        ctx.services.audit.log({
          adminTelegramId: String(ctx.from!.id),
          action: "restart",
          success: true,
        });
      } else if (confirmation.action === "apply-config") {
        const output = await ctx.services.hysteriaService.applyConfig();
        await ctx.reply(`Config applied.\n${output}`);
        ctx.services.audit.log({
          adminTelegramId: String(ctx.from!.id),
          action: "apply_config",
          success: true,
        });
      }

      ctx.services.confirmations.consume(token);
    } catch (error) {
      ctx.services.audit.log({
        adminTelegramId: String(ctx.from!.id),
        action: confirmation.action,
        payload: payload as unknown as Record<string, unknown>,
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      ctx.services.confirmations.consume(token);
      throw error;
    }
  });
}
