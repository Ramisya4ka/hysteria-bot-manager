#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import YAML from "yaml";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { _: command };

  for (let i = 0; i < rest.length; i += 1) {
    const current = rest[i];
    if (!current.startsWith("--")) {
      continue;
    }
    args[current.slice(2)] = rest[i + 1];
    i += 1;
  }

  return args;
}

function requireArg(args, key) {
  const value = args[key];
  if (!value) {
    fail(`Missing required argument --${key}`);
  }
  return value;
}

function openDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    fail(`SQLite database not found: ${dbPath}`);
  }
  return new Database(dbPath, { readonly: true });
}

function loadSettingsAndUsers(dbPath) {
  const db = openDb(dbPath);
  const settings = db.prepare("SELECT * FROM server_settings WHERE id = 1").get();
  if (!settings) {
    fail("server_settings row id=1 not found");
  }
  const users = db.prepare("SELECT username, password FROM hysteria_users WHERE enabled = 1 ORDER BY username").all();
  return { settings, users };
}

function buildConfig(settings, users) {
  const userpass = {};
  for (const user of users) {
    userpass[user.username] = user.password;
  }

  const config = {
    listen: `:${settings.port}`,
    tls: {
      cert: settings.cert_path,
      key: settings.key_path,
    },
    auth: {
      type: "userpass",
      userpass,
    },
  };

  if (settings.masquerade_url) {
    config.masquerade = {
      type: "proxy",
      proxy: {
        url: settings.masquerade_url,
      },
    };
  }

  if (settings.udp_idle_timeout) {
    config.quic = {
      udpIdleTimeout: settings.udp_idle_timeout,
    };
  }

  if (settings.obfs_type === "salamander" && settings.obfs_password) {
    config.transport = {
      obfs: {
        type: "salamander",
        salamander: {
          password: settings.obfs_password,
        },
      },
    };
  }

  return config;
}

function runCommand(bin, args) {
  return execFileSync(bin, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function supportsTestFlag(validatorBin) {
  const result = spawnSync(validatorBin, ["server", "--help"], {
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  return output.includes("--test");
}

function validateGeneratedConfig(settings, configOut, config) {
  if (!settings.domain || typeof settings.domain !== "string") {
    fail("Invalid server setting: domain is required");
  }

  if (!Number.isInteger(settings.port) || settings.port <= 0 || settings.port > 65535) {
    fail("Invalid server setting: port must be between 1 and 65535");
  }

  if (!fs.existsSync(settings.cert_path)) {
    fail(`TLS certificate not found: ${settings.cert_path}`);
  }

  if (!fs.existsSync(settings.key_path)) {
    fail(`TLS key not found: ${settings.key_path}`);
  }

  if (!config.auth || config.auth.type !== "userpass" || typeof config.auth.userpass !== "object") {
    fail("Generated config auth section is invalid");
  }

  if (!path.isAbsolute(configOut)) {
    fail(`Config output path must be absolute: ${configOut}`);
  }
}

function getServiceState(service) {
  const result = spawnSync("systemctl", ["is-active", service], {
    encoding: "utf8",
  });

  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return output || "unknown";
}

function handleStatus(args) {
  const dbPath = requireArg(args, "db");
  const service = requireArg(args, "service");
  const { settings, users } = loadSettingsAndUsers(dbPath);
  const state = getServiceState(service);

  console.log(
    JSON.stringify({
      service,
      state,
      usersCount: users.length,
      domain: settings.domain,
      port: settings.port,
      obfsEnabled: settings.obfs_type === "salamander",
    }),
  );
}

function handleLogs(args) {
  const service = requireArg(args, "service");
  const lines = args.lines || "30";
  const output = runCommand("journalctl", ["-u", service, "-n", lines, "--no-pager", "-o", "cat"]);
  console.log(output);
}

function handleApply(args) {
  const dbPath = requireArg(args, "db");
  const configOut = requireArg(args, "config-out");
  const service = requireArg(args, "service");
  const validatorBin = requireArg(args, "validator-bin");
  const { settings, users } = loadSettingsAndUsers(dbPath);
  const config = buildConfig(settings, users);
  validateGeneratedConfig(settings, configOut, config);
  const yamlText = YAML.stringify(config);
  const tempPath = `${configOut}.tmp.${process.pid}`;
  fs.mkdirSync(path.dirname(configOut), { recursive: true });
  fs.writeFileSync(tempPath, yamlText, { encoding: "utf8", mode: 0o600 });

  try {
    if (supportsTestFlag(validatorBin)) {
      runCommand(validatorBin, ["server", "-c", tempPath, "--test"]);
    }

    if (fs.existsSync(configOut)) {
      const backupPath = `${configOut}.${Date.now()}.bak`;
      fs.copyFileSync(configOut, backupPath);
    }

    fs.renameSync(tempPath, configOut);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
  }

  runCommand("systemctl", ["restart", service]);
  console.log("config applied, validated, and service restarted");
}

function handleRestart(args) {
  const service = requireArg(args, "service");
  runCommand("systemctl", ["restart", service]);
  console.log("service restarted");
}

const args = parseArgs(process.argv.slice(2));

switch (args._) {
  case "status":
    handleStatus(args);
    break;
  case "logs":
    handleLogs(args);
    break;
  case "apply":
    handleApply(args);
    break;
  case "restart":
    handleRestart(args);
    break;
  default:
    fail("Usage: hysteria-admin-helper <status|logs|apply|restart> [--key value]");
}
