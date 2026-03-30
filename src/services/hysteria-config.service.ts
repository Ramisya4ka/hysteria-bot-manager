import { SettingsRepository } from "../repositories/settings.repository";
import { UserRepository } from "../repositories/user.repository";
import type { ServerSettings } from "../types/models";

export class HysteriaConfigService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  getSettingsOrThrow(): ServerSettings {
    const settings = this.settingsRepository.get();
    if (!settings) {
      throw new Error("Server settings are not initialized in SQLite");
    }
    return settings;
  }

  buildStructuredConfig(): Record<string, unknown> {
    const settings = this.getSettingsOrThrow();
    const enabledUsers = this.userRepository
      .listAll()
      .filter((user) => user.enabled)
      .reduce<Record<string, string>>((acc, user) => {
        acc[user.username] = user.password;
        return acc;
      }, {});

    return {
      listen: `:${settings.port}`,
      tls: {
        cert: settings.certPath,
        key: settings.keyPath,
      },
      auth: {
        type: "userpass",
        userpass: enabledUsers,
      },
      masquerade: settings.masqueradeUrl ? { type: "proxy", proxy: { url: settings.masqueradeUrl } } : undefined,
      transport:
        settings.obfsType === "salamander" && settings.obfsPassword
          ? {
              obfs: {
                type: "salamander",
                salamander: {
                  password: settings.obfsPassword,
                },
              },
            }
          : undefined,
      quic:
        settings.udpIdleTimeout
          ? {
              udpIdleTimeout: settings.udpIdleTimeout,
            }
          : undefined,
    };
  }
}
