#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import YAML from "yaml";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) {
      continue;
    }
    args[current.slice(2)] = argv[i + 1];
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

function extractPort(listen) {
  if (typeof listen !== "string") {
    return 443;
  }

  const match = listen.match(/:(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 443;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = requireArg(args, "db");
  const configPath = requireArg(args, "config");
  const serviceName = args.service || "hysteria-server";

  if (!fs.existsSync(dbPath)) {
    fail(`SQLite database not found: ${dbPath}`);
  }
  if (!fs.existsSync(configPath)) {
    fail(`Config file not found: ${configPath}`);
  }

  const rawConfig = fs.readFileSync(configPath, "utf8");
  const parsed = YAML.parse(rawConfig);
  const users = parsed?.auth?.userpass;

  if (!users || typeof users !== "object") {
    fail("Config does not contain auth.userpass");
  }

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  const settings = {
    domain:
      parsed?.tls?.sni ||
      parsed?.server_name ||
      parsed?.sni ||
      parsed?.masquerade?.proxy?.rewriteHost ||
      "taburetka.duckdns.org",
    port: extractPort(parsed.listen),
    certPath: parsed?.tls?.cert || "/etc/hysteria/certs/fullchain.pem",
    keyPath: parsed?.tls?.key || "/etc/hysteria/certs/privkey.pem",
    masqueradeUrl: parsed?.masquerade?.proxy?.url || null,
    udpIdleTimeout: parsed?.quic?.udpIdleTimeout || null,
    obfsType: parsed?.transport?.obfs?.type || null,
    obfsPassword: parsed?.transport?.obfs?.salamander?.password || null,
    serviceName,
    configPath,
  };

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO server_settings
      (id, domain, port, cert_path, key_path, masquerade_url, udp_idle_timeout, obfs_type, obfs_password, service_name, config_path, created_at, updated_at)
     VALUES
      (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain,
      port = excluded.port,
      cert_path = excluded.cert_path,
      key_path = excluded.key_path,
      masquerade_url = excluded.masquerade_url,
      udp_idle_timeout = excluded.udp_idle_timeout,
      obfs_type = excluded.obfs_type,
      obfs_password = excluded.obfs_password,
      service_name = excluded.service_name,
      config_path = excluded.config_path,
      updated_at = excluded.updated_at`,
  ).run(
    settings.domain,
    settings.port,
    settings.certPath,
    settings.keyPath,
    settings.masqueradeUrl,
    settings.udpIdleTimeout,
    settings.obfsType,
    settings.obfsPassword,
    settings.serviceName,
    settings.configPath,
    now,
    now,
  );

  const selectUser = db.prepare("SELECT id FROM hysteria_users WHERE username = ?");
  const insertUser = db.prepare(
    `INSERT INTO hysteria_users (username, password, note, enabled, created_at, updated_at)
     VALUES (?, ?, NULL, 1, ?, ?)`,
  );
  const updateUser = db.prepare(
    `UPDATE hysteria_users
     SET password = ?, enabled = 1, updated_at = ?
     WHERE username = ?`,
  );

  let imported = 0;
  for (const [username, password] of Object.entries(users)) {
    if (typeof password !== "string") {
      continue;
    }

    const existing = selectUser.get(username);
    if (existing) {
      updateUser.run(password, now, username);
    } else {
      insertUser.run(username, password, now, now);
    }
    imported += 1;
  }

  console.log(
    JSON.stringify({
      importedUsers: imported,
      settings,
      note: "Existing YAML users synced into SQLite. No users were deleted.",
    }),
  );
}

main();
