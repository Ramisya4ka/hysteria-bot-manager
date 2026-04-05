import { InlineKeyboard } from "grammy";
import type { HysteriaUser } from "../types/models";

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Status", "menu:status")
    .text("Users", "menu:users")
    .row()
    .text("Logs", "menu:logs")
    .text("Settings", "menu:settings")
    .row()
    .text("Restart", "menu:restart")
    .text("Apply config", "menu:apply")
    .row()
    .text("Refresh", "menu:home");
}

export function usersKeyboard(users: HysteriaUser[]): InlineKeyboard {
  const keyboard = new InlineKeyboard().text("Add user", "users:add").row();

  for (const user of users) {
    keyboard.text(user.username, `user:view:${user.id}`).row();
  }

  return keyboard.text("Refresh", "users:list").text("Home", "menu:home");
}

export function userDetailsKeyboard(user: HysteriaUser): InlineKeyboard {
  return new InlineKeyboard()
    .text("URI", `user:uri:${user.id}`)
    .text("QR", `user:qr:${user.id}`)
    .row()
    .text(user.enabled ? "Disable" : "Enable", `user:toggle:${user.id}`)
    .text("Delete", `user:delete:${user.id}`)
    .row()
    .text("Back", "menu:users")
    .text("Home", "menu:home");
}

export function userUriKeyboard(user: HysteriaUser): InlineKeyboard {
  return new InlineKeyboard()
    .text("QR", `user:qr:${user.id}`)
    .row()
    .text("Back", `user:view:${user.id}`)
    .text("Home", "menu:home");
}

export function userQrKeyboard(user: HysteriaUser): InlineKeyboard {
  return new InlineKeyboard()
    .text("URI", `user:uri:${user.id}`)
    .row()
    .text("Back", `user:view:${user.id}`)
    .text("Home", "menu:home");
}

export function screenNavKeyboard(backCallback = "menu:home"): InlineKeyboard {
  return new InlineKeyboard().text("Back", backCallback).text("Home", "menu:home");
}

export function flowCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Cancel", "flow:cancel").text("Home", "menu:home");
}

export function confirmationKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard().text("Confirm", `confirm:${token}`).text("Cancel", `cancel:${token}`);
}
