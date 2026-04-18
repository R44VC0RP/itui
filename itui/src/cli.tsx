#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app.tsx";
import {
  configPath,
  DEFAULT_CONFIG,
  loadOrCreateConfig,
  saveConfig,
  updateConfig,
  type Config,
} from "./config.ts";

const argv = process.argv.slice(2);

async function main() {
  const first = argv[0];

  if (first === "-h" || first === "--help" || first === "help") {
    printHelp();
    return;
  }

  if (first === "-v" || first === "--version" || first === "version") {
    printVersion();
    return;
  }

  if (first === "config") {
    runConfigCommand(argv.slice(1));
    return;
  }

  const { config, created } = loadOrCreateConfig();
  const cliOverrides = parseOverrides(argv);
  const effective: Config = { ...config, ...cliOverrides };

  if (created) {
    // First run. Give the user a moment of context before the full-screen TUI takes
    // over, so they know where the config lives and how to change it.
    process.stderr.write(
      `Created default config at ${configPath()}\n` +
        `  server: ${effective.server}\n` +
        `Edit it or run 'itui config set server=https://your-host:13197' to change.\n\n`,
    );
  }

  await launchTUI(effective);
}

function printHelp(): void {
  process.stdout.write(
    [
      "itui — terminal UI for iMessage",
      "",
      "Usage:",
      "  itui                        launch the TUI",
      "  itui --server=<url>         override server for this run",
      "  itui --token=<token>        override bearer token for this run",
      "  itui config                 print config path + current values",
      "  itui config set key=val     update a config key",
      "  itui config path            print just the config file path",
      "  itui config reset           restore all defaults",
      "  itui --help | -h            show this help",
      "  itui --version | -v         show the installed version",
      "",
      "Config keys (set via `itui config set key=value`):",
      "",
      "  server              string   http://127.0.0.1:13197",
      "                      Base URL of the imsg serve HTTP API.",
      "",
      "  token               string   null",
      "                      Bearer token for server auth (future).",
      "",
      "  defaultChatId       number   null",
      "                      Chat ID to open on launch.",
      "",
      "  reconnectDelayMs    number   2000",
      "                      ms between SSE reconnect attempts.",
      "",
      "  hideHandles         bool     true",
      "                      Hide phone numbers and emails; show",
      "                      only resolved contact names.",
      "",
      "  notifications       bool     true",
      "                      Desktop notifications for incoming",
      "                      messages (notify-send / osascript).",
      "",
      "  notificationSound   bool     true",
      "                      Play a sound with notifications.",
      "",
      "  header.<Name>       string   (none)",
      "                      Set a custom HTTP header sent with every",
      "                      request. Useful for proxy auth, e.g.:",
      "                      itui config set \\",
      "                        header.CF-Access-Client-Id=xxx \\",
      "                        header.CF-Access-Client-Secret=yyy",
      "                      Remove with header.Name=null",
      "",
      "Config file: ~/.config/itui/config.json (respects $XDG_CONFIG_HOME)",
      "",
    ].join("\n"),
  );
}

function printVersion(): void {
  // package.json is next to src/ when installed; fall back gracefully if unreadable.
  try {
    const pkg = require("../package.json") as { version?: string };
    process.stdout.write(`${pkg.version ?? "0.0.0"}\n`);
  } catch {
    process.stdout.write("0.0.0\n");
  }
}

function runConfigCommand(args: string[]): void {
  const sub = args[0];
  if (!sub || sub === "show") {
    const { config } = loadOrCreateConfig();
    process.stdout.write(`${configPath()}\n`);
    process.stdout.write(JSON.stringify(config, null, 2) + "\n");
    return;
  }
  if (sub === "path") {
    process.stdout.write(`${configPath()}\n`);
    return;
  }
  if (sub === "reset") {
    saveConfig({ ...DEFAULT_CONFIG });
    process.stdout.write(`Reset ${configPath()} to defaults.\n`);
    return;
  }
  if (sub === "set") {
    const pairs = args.slice(1);
    if (pairs.length === 0) {
      process.stderr.write("usage: itui config set key=value [key=value ...]\n");
      process.exit(1);
    }
    const patch: Partial<Config> = {};
    for (const pair of pairs) {
      const eq = pair.indexOf("=");
      if (eq === -1) {
        process.stderr.write(`invalid pair: ${pair} (expected key=value)\n`);
        process.exit(1);
      }
      const key = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      applyConfigKey(patch, key, value);
    }
    const next = updateConfig(patch);
    process.stdout.write(JSON.stringify(next, null, 2) + "\n");
    return;
  }
  process.stderr.write(`unknown config subcommand: ${sub}\n`);
  process.exit(1);
}

function applyConfigKey(patch: Partial<Config>, key: string, value: string): void {
  switch (key) {
    case "server":
      patch.server = value;
      return;
    case "token":
      patch.token = value === "" || value === "null" ? null : value;
      return;
    case "defaultChatId":
    case "default_chat_id": {
      const n = Number(value);
      patch.defaultChatId = Number.isFinite(n) ? n : null;
      return;
    }
    case "reconnectDelayMs":
    case "reconnect_delay_ms": {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        process.stderr.write(`invalid reconnectDelayMs: ${value}\n`);
        process.exit(1);
      }
      patch.reconnectDelayMs = n;
      return;
    }
    case "hideHandles":
    case "hide_handles":
      patch.hideHandles = value === "true" || value === "1";
      return;
    case "notifications":
      patch.notifications = value === "true" || value === "1";
      return;
    case "notificationSound":
    case "notification_sound":
      patch.notificationSound = value === "true" || value === "1";
      return;
    default:
      if (key.startsWith("header.")) {
        const name = key.slice("header.".length);
        if (!name) {
          process.stderr.write("header name cannot be empty\n");
          process.exit(1);
        }
        if (!patch.customHeaders) {
          const { config } = loadOrCreateConfig();
          patch.customHeaders = { ...config.customHeaders };
        }
        if (value === "" || value === "null") {
          delete patch.customHeaders[name];
        } else {
          try {
            new Headers([[name, value]]);
          } catch {
            process.stderr.write(`invalid header ${name}\n`);
            process.exit(1);
          }
          patch.customHeaders[name] = value;
        }
        return;
      }
      process.stderr.write(`unknown config key: ${key}\n`);
      process.exit(1);
  }
}

function parseOverrides(args: string[]): Partial<Config> {
  const patch: Partial<Config> = {};
  for (const arg of args) {
    if (arg.startsWith("--server=")) patch.server = arg.slice("--server=".length);
    else if (arg.startsWith("--token=")) patch.token = arg.slice("--token=".length) || null;
  }
  return patch;
}

async function launchTUI(config: Config): Promise<void> {
  // Ctrl+C is handled in-app so it can clear the composer instead of quitting when the
  // user is mid-message. `q` and explicit quit paths take care of actually exiting.
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
  });
  createRoot(renderer).render(<App config={config} />);
}

await main();
