import { InlineKeyboard } from "grammy";
import type { HysteriaUser } from "../types/models";

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Status", "menu:status")
    .text("Users", "menu:users")
    .row()
    .text("Logs", "menu:logs")
    .text("Restart", "menu:restart")
    .row()
    .text("Apply config", "menu:apply")
    .text("Settings", "menu:settings");
}

export function usersKeyboard(users: HysteriaUser[]): InlineKeyboard {
  const keyboard = new InlineKeyboard().text("Add user", "users:add").row();

  for (const user of users) {
    const toggleLabel = user.enabled ? "Disable" : "Enable";
    keyboard
      .text(`URI ${user.username}`, `user:uri:${user.id}`)
      .text(`QR ${user.username}`, `user:qr:${user.id}`)
      .row()
      .text(`${toggleLabel} ${user.username}`, `user:toggle:${user.id}`)
      .row()
      .text(`Delete ${user.username}`, `user:delete:${user.id}`)
      .row();
  }

  return keyboard.text("Refresh", "users:list");
}

export function confirmationKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard().text("Confirm", `confirm:${token}`).text("Cancel", `cancel:${token}`);
}
