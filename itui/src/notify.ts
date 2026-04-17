import { spawn } from "node:child_process";
import { platform } from "node:os";
import type { Config } from "./config.ts";
import type { Message } from "./api/types.ts";

/**
 * Cross-platform desktop notification for incoming messages.
 *
 *   Omarchy / Linux → notify-send (freedesktop) + canberra-gtk-play for sound
 *   macOS            → osascript (Notification Center, plays sound natively)
 *   Fallback         → terminal BEL (\x07)
 *
 * Notifications are fire-and-forget — errors are silently swallowed so a missing
 * `notify-send` binary never crashes the TUI.
 */
export function notifyNewMessage(
  config: Config,
  message: Message,
  chatName: string,
): void {
  if (!config.notifications) return;
  if (message.is_from_me) return;
  if (message.is_reaction) return;

  const sender = message.sender_contact?.name ?? (config.hideHandles ? "Unknown" : message.sender);
  const title = chatName || sender;
  const body = message.text || "[attachment]";

  const os = platform();
  if (os === "linux") {
    notifyLinux(title, body, config.notificationSound);
  } else if (os === "darwin") {
    notifyMacOS(title, body, config.notificationSound);
  } else {
    notifyBell();
  }
}

function notifyLinux(title: string, body: string, sound: boolean): void {
  try {
    // notify-send is the standard freedesktop notification tool, present on every
    // Omarchy install (and most other Linux desktops).
    const args = [
      "--app-name=itui",
      "--icon=dialog-information",
      "-t", "5000",
      title,
      body,
    ];
    fire("notify-send", args);

    if (sound) {
      // canberra-gtk-play ships with libcanberra and is available on Omarchy. The
      // "message-new-instant" sound ID is the freedesktop standard for IM notifications.
      // Falls back silently if the binary or sound theme is missing.
      fire("canberra-gtk-play", [
        "--id=message-new-instant",
        "--description=New iMessage",
      ]);
    }
  } catch {
    notifyBell();
  }
}

function notifyMacOS(title: string, body: string, sound: boolean): void {
  try {
    // osascript one-liner that posts to Notification Center. The `sound name` clause
    // triggers the system default notification sound.
    const soundClause = sound ? ' sound name "Blow"' : "";
    const script = `display notification ${escapeAS(body)} with title ${escapeAS(title)}${soundClause}`;
    fire("osascript", ["-e", script]);
  } catch {
    notifyBell();
  }
}

function notifyBell(): void {
  process.stderr.write("\x07");
}

/** Fire a subprocess and forget about it — don't wait, don't throw. */
function fire(cmd: string, args: string[]): void {
  try {
    const child = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
    });
    child.unref();
  } catch {
    // Binary not found or spawn failed — swallow silently.
  }
}

/** Escape a string for AppleScript quoted form. */
function escapeAS(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
