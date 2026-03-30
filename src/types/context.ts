import type { Context, SessionFlavor } from "grammy";
import type { SessionData } from "./session";
import type { ServiceContainer } from "../utils/service-container";

export type BotContext = Context &
  SessionFlavor<SessionData> & {
    services: ServiceContainer;
  };
