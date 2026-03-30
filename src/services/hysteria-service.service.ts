import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Env } from "../config/env";

const execFileAsync = promisify(execFile);

export interface ServiceStatus {
  service: string;
  state: string;
  usersCount: number;
  domain: string;
  port: number;
  obfsEnabled: boolean;
}

export class HysteriaService {
  constructor(private readonly env: Env) {}

  private async runHelperExec(args: string[]): Promise<string> {
    const result = await execFileAsync(this.env.HOST_HELPER_PATH, args, {
      windowsHide: true,
      shell: false,
    });
    return result.stdout.trim();
  }

  private async runHelperRelay(command: string, payload: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          method: "POST",
          socketPath: this.env.HOST_HELPER_SOCKET_PATH,
          path: `/v1/${command}`,
          headers: {
            "content-type": "application/json",
          },
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              try {
                const parsed = JSON.parse(body) as { output?: string; data?: unknown };
                if (parsed.output) {
                  resolve(parsed.output);
                  return;
                }
                resolve(JSON.stringify(parsed.data ?? {}));
              } catch {
                resolve(body.trim());
              }
              return;
            }

            reject(new Error(`Relay request failed with status ${response.statusCode ?? "unknown"}: ${body}`));
          });
        },
      );

      request.on("error", reject);
      request.write(JSON.stringify(payload));
      request.end();
    });
  }

  private async runHelper(command: string, args: string[], relayPayload: Record<string, unknown>): Promise<string> {
    if (this.env.HOST_HELPER_MODE === "unix-http") {
      return this.runHelperRelay(command, relayPayload);
    }
    return this.runHelperExec(args);
  }

  async status(): Promise<ServiceStatus> {
    const stdout = await this.runHelper(
      "status",
      ["status", "--db", this.env.databasePathAbsolute, "--service", this.env.HYSTERIA_SERVICE_NAME],
      {
        dbPath: this.env.databasePathAbsolute,
        service: this.env.HYSTERIA_SERVICE_NAME,
      },
    );
    return JSON.parse(stdout) as ServiceStatus;
  }

  async getLogs(lines: number): Promise<string> {
    return this.runHelper(
      "logs",
      ["logs", "--service", this.env.HYSTERIA_SERVICE_NAME, "--lines", String(lines)],
      {
        service: this.env.HYSTERIA_SERVICE_NAME,
        lines,
      },
    );
  }

  async applyConfig(): Promise<string> {
    return this.runHelper(
      "apply",
      [
        "apply",
        "--db",
        this.env.databasePathAbsolute,
        "--config-out",
        this.env.HYSTERIA_CONFIG_OUTPUT_PATH,
        "--service",
        this.env.HYSTERIA_SERVICE_NAME,
        "--validator-bin",
        this.env.HYSTERIA_VALIDATOR_BIN,
      ],
      {
        dbPath: this.env.databasePathAbsolute,
        configOut: this.env.HYSTERIA_CONFIG_OUTPUT_PATH,
        service: this.env.HYSTERIA_SERVICE_NAME,
        validatorBin: this.env.HYSTERIA_VALIDATOR_BIN,
      },
    );
  }

  async restartService(): Promise<string> {
    return this.runHelper(
      "restart",
      ["restart", "--service", this.env.HYSTERIA_SERVICE_NAME],
      {
        service: this.env.HYSTERIA_SERVICE_NAME,
      },
    );
  }
}
