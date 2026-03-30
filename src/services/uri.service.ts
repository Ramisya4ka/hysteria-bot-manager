import type { HysteriaUser, ServerSettings } from "../types/models";

export class UriService {
  build(user: HysteriaUser, settings: ServerSettings, scheme: "hy2" | "hysteria2" = "hy2"): string {
    const encodedUser = encodeURIComponent(user.username);
    const encodedPassword = encodeURIComponent(user.password);
    const query = new URLSearchParams();
    query.set("sni", settings.domain);

    if (settings.obfsType === "salamander" && settings.obfsPassword) {
      query.set("obfs", "salamander");
      query.set("obfs-password", settings.obfsPassword);
    }

    return `${scheme}://${encodedUser}:${encodedPassword}@${settings.domain}:${settings.port}/?${query.toString()}#${encodeURIComponent(user.username)}`;
  }
}
