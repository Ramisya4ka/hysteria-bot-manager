export class AuthzService {
  constructor(private readonly adminTelegramIds: Set<number>) {}

  isAllowedTelegramId(userId: number | undefined): boolean {
    return typeof userId === "number" && this.adminTelegramIds.has(userId);
  }
}
