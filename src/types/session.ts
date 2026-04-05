export type AddUserStep = "username" | "password" | "note" | "enabled";

export interface AddUserDraft {
  username?: string;
  password?: string;
  note?: string | null;
  enabled?: boolean;
}

export interface SessionData {
  ui: {
    screenMessageId: number | null;
  };
  flow:
    | {
        type: "add-user";
        step: AddUserStep;
        draft: AddUserDraft;
      }
    | null;
}

export const initialSessionData = (): SessionData => ({
  ui: {
    screenMessageId: null,
  },
  flow: null,
});
