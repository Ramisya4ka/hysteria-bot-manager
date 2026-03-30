export type AddUserStep = "username" | "password" | "note" | "enabled";

export interface AddUserDraft {
  username?: string;
  password?: string;
  note?: string | null;
  enabled?: boolean;
}

export interface SessionData {
  flow:
    | {
        type: "add-user";
        step: AddUserStep;
        draft: AddUserDraft;
      }
    | null;
}

export const initialSessionData = (): SessionData => ({
  flow: null,
});
