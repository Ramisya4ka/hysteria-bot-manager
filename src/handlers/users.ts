import type { Bot } from "grammy";
import type { BotContext } from "../types/context";
import { usersKeyboard } from "../utils/keyboards";

function usersListText(ctx: BotContext): string {
  const users = ctx.services.users.listAll();
  if (users.length === 0) {
    return "No users";
  }

  return users
    .map((user) => `- ${user.username} (${user.enabled ? "enabled" : "disabled"})${user.note ? ` | ${user.note}` : ""}`)
    .join("\n");
}

async function renderUsersList(ctx: BotContext): Promise<void> {
  const users = ctx.services.users.listAll();
  await ctx.reply(usersListText(ctx), {
    reply_markup: usersKeyboard(users),
  });
}

async function applyWithRollback(
  ctx: BotContext,
  forward: () => void,
  rollback: () => void,
  action: string,
  payload: Record<string, unknown>,
  successMessage: string,
): Promise<void> {
  try {
    forward();
    await ctx.services.hysteriaService.applyConfig();
    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action,
      payload,
      success: true,
    });
    await ctx.reply(successMessage);
  } catch (error) {
    rollback();
    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action,
      payload,
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

function parseEnabledInput(text: string): boolean | null {
  const normalized = text.trim().toLowerCase();
  if (["yes", "y", "on", "enable", "enabled", "1"].includes(normalized)) {
    return true;
  }
  if (["no", "n", "off", "disable", "disabled", "0"].includes(normalized)) {
    return false;
  }
  return null;
}

export function registerUsersHandler(bot: Bot<BotContext>): void {
  bot.command("users", async (ctx) => {
    await renderUsersList(ctx);
    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action: "users_list",
      success: true,
    });
  });

  bot.callbackQuery("menu:users", async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderUsersList(ctx);
  });

  bot.callbackQuery("users:list", async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderUsersList(ctx);
  });

  bot.callbackQuery("users:add", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.flow = {
      type: "add-user",
      step: "username",
      draft: {},
    };
    await ctx.reply("Enter username:");
  });

  bot.callbackQuery(/^user:uri:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = Number(ctx.match[1]);
    const user = ctx.services.users.getById(userId);
    const settings = ctx.services.settings.get();

    if (!user || !settings) {
      await ctx.reply("User or settings not found.");
      return;
    }

    await ctx.reply(ctx.services.uri.build(user, settings));
    ctx.services.audit.log({
      adminTelegramId: String(ctx.from!.id),
      action: "user_uri",
      payload: { userId, username: user.username },
      success: true,
    });
  });

  bot.callbackQuery(/^user:toggle:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = Number(ctx.match[1]);
    const user = ctx.services.users.getById(userId);
    if (!user) {
      await ctx.reply("User not found.");
      return;
    }

    const nextState = !user.enabled;
    await applyWithRollback(
      ctx,
      () => ctx.services.users.updateEnabled(userId, nextState),
      () => ctx.services.users.updateEnabled(userId, user.enabled),
      "user_toggle",
      { userId, username: user.username, enabled: nextState },
      `User ${user.username} ${nextState ? "enabled" : "disabled"}.`,
    );
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.session.flow?.type !== "add-user") {
      await next();
      return;
    }

    const text = ctx.message.text.trim();

    if (ctx.session.flow.step === "username") {
      if (!/^[a-zA-Z0-9._-]{3,64}$/.test(text)) {
        await ctx.reply("Username must match `[a-zA-Z0-9._-]{3,64}`. Enter username again:");
        return;
      }
      if (ctx.services.users.getByUsername(text)) {
        await ctx.reply("Username already exists. Enter another username:");
        return;
      }
      ctx.session.flow.draft.username = text;
      ctx.session.flow.step = "password";
      await ctx.reply("Enter password:");
      return;
    }

    if (ctx.session.flow.step === "password") {
      if (text.length < 8 || text.length > 128) {
        await ctx.reply("Password length must be between 8 and 128. Enter password again:");
        return;
      }
      ctx.session.flow.draft.password = text;
      ctx.session.flow.step = "note";
      await ctx.reply("Enter note or `-` for empty:");
      return;
    }

    if (ctx.session.flow.step === "note") {
      ctx.session.flow.draft.note = text === "-" ? null : text;
      ctx.session.flow.step = "enabled";
      await ctx.reply("Enable user now? Reply yes/no:");
      return;
    }

    if (ctx.session.flow.step === "enabled") {
      const enabled = parseEnabledInput(text);
      if (enabled === null) {
        await ctx.reply("Reply with yes or no:");
        return;
      }

      const draft = {
        username: ctx.session.flow.draft.username!,
        password: ctx.session.flow.draft.password!,
        note: ctx.session.flow.draft.note ?? null,
        enabled,
      };

      ctx.session.flow = null;
      let createdUserId = 0;

      await applyWithRollback(
        ctx,
        () => {
          createdUserId = ctx.services.users.create(draft).id;
        },
        () => {
          if (createdUserId) {
            ctx.services.users.delete(createdUserId);
          }
        },
        "user_add",
        { username: draft.username, enabled: draft.enabled },
        "User created and config applied.",
      );

      const created = ctx.services.users.getByUsername(draft.username);
      const settings = ctx.services.settings.get();
      if (created && settings) {
        await ctx.reply(ctx.services.uri.build(created, settings));
      }
      return;
    }
  });
}
