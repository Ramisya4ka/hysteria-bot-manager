#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const socketPath = process.env.HYSTERIA_HELPER_SOCKET_PATH || "/var/run/hysteria-bot/helper.sock";
const helperPath = process.env.HYSTERIA_HELPER_PATH || "/opt/bots-project/hysteria-bot/scripts/hysteria-admin-helper";

async function runHelper(args) {
  const result = await execFileAsync(helperPath, args, {
    shell: false,
    windowsHide: true,
  });
  return result.stdout.trim();
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function send(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function handle(command, payload) {
  switch (command) {
    case "status":
      return {
        data: JSON.parse(
          await runHelper(["status", "--db", payload.dbPath, "--service", payload.service]),
        ),
      };
    case "logs":
      return {
        output: await runHelper(["logs", "--service", payload.service, "--lines", String(payload.lines)]),
      };
    case "apply":
      return {
        output: await runHelper([
          "apply",
          "--db",
          payload.dbPath,
          "--config-out",
          payload.configOut,
          "--service",
          payload.service,
          "--validator-bin",
          payload.validatorBin,
        ]),
      };
    case "restart":
      return {
        output: await runHelper(["restart", "--service", payload.service]),
      };
    default:
      throw new Error(`Unsupported relay command: ${command}`);
  }
}

fs.mkdirSync(socketPath.replace(/\/[^/]+$/, ""), { recursive: true });
if (fs.existsSync(socketPath)) {
  fs.rmSync(socketPath, { force: true });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith("/v1/")) {
    send(res, 404, { error: "Not found" });
    return;
  }

  const command = req.url.slice(4);

  try {
    const payload = await readJson(req);
    const result = await handle(command, payload);
    send(res, 200, result);
  } catch (error) {
    send(res, 500, {
      error: error instanceof Error ? error.message : "Unknown relay error",
    });
  }
});

server.listen(socketPath, () => {
  fs.chmodSync(socketPath, 0o660);
  console.log(`Hysteria relay listening on ${socketPath}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close(() => {
      if (fs.existsSync(socketPath)) {
        fs.rmSync(socketPath, { force: true });
      }
      process.exit(0);
    });
  });
}
