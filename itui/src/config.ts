import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface Config {
  /** Base URL of the `imsg serve` HTTP API, e.g. `http://127.0.0.1:8080`. */
  server: string;
  /** Optional bearer token. The imsg server does not require auth today, but leaving this
   * in the config now means once auth is added, upgrading is a one-line change. */
  token: string | null;
  /** Default chat id to open on launch. Nil opens the sidebar without a selection. */
  defaultChatId: number | null;
  /** ms between SSE reconnect attempts when the server drops or errors. */
  reconnectDelayMs: number;
  /** When true, phone numbers and emails are hidden everywhere — sidebar, conversation
   * header, message sender labels. Only resolved contact names are shown. Handles that
   * have no contact name are displayed as "Unknown". */
  hideHandles: boolean;
  /** Desktop notifications for incoming messages. Works cross-platform:
   *  - Omarchy / Linux: `notify-send` (freedesktop)
   *  - macOS: `osascript` (Notification Center)
   *  - Fallback: terminal BEL character */
  notifications: boolean;
  /** Play a sound with the notification. On Omarchy this uses freedesktop sound names
   * via `canberra-gtk-play`; on macOS it uses the system notification sound. */
  notificationSound: boolean;
}

export const DEFAULT_CONFIG: Config = {
  server: "http://127.0.0.1:8080",
  token: null,
  defaultChatId: null,
  reconnectDelayMs: 2000,
  hideHandles: true,
  notifications: true,
  notificationSound: true,
};

/**
 * Honours `$XDG_CONFIG_HOME` if set, otherwise falls back to `~/.config`.
 *
 * macOS canonically puts app prefs under `~/Library/Application Support`, but the user
 * asked for `.config/itui/config.json`, which matches XDG and is what most TUI tools
 * expect on a developer's box.
 */
export function configPath(): string {
  const base =
    process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.length > 0
      ? process.env.XDG_CONFIG_HOME
      : join(homedir(), ".config");
  return join(base, "itui", "config.json");
}

/**
 * Load the config, creating it with defaults if missing. Corrupt files are backed up as
 * `config.json.corrupt-<timestamp>` so we never silently overwrite the user's settings.
 */
export function loadOrCreateConfig(): { config: Config; created: boolean } {
  const path = configPath();
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
    return { config: { ...DEFAULT_CONFIG }, created: true };
  }
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    // Merge so new keys in later versions get picked up without forcing the user to
    // rewrite their config by hand.
    return { config: { ...DEFAULT_CONFIG, ...parsed }, created: false };
  } catch (err) {
    const backup = `${path}.corrupt-${Date.now()}`;
    try {
      writeFileSync(backup, readFileSync(path, "utf8"), "utf8");
    } catch {
      // Best-effort; don't die here.
    }
    writeFileSync(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
    return { config: { ...DEFAULT_CONFIG }, created: true };
  }
}

export function saveConfig(config: Config): void {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/**
 * Update one or more fields and persist. Returns the new config.
 */
export function updateConfig(patch: Partial<Config>): Config {
  const { config } = loadOrCreateConfig();
  const next: Config = { ...config, ...patch };
  saveConfig(next);
  return next;
}
