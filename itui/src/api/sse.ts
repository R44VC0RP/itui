import type { Config } from "../config.ts";
import type { Message } from "./types.ts";

/**
 * Minimal SSE client tailored for the imsg `/api/events` stream.
 *
 * Why not use the browser `EventSource`? Node/Bun have it behind a flag on older
 * versions, and we want tight control over reconnect + `since_rowid` resume so we never
 * miss a message when the TCP connection flaps. This parser handles exactly the shape
 * the imsg server emits (`event: message\ndata: <json>\n\n`) and ignores the rest.
 */
export class ImsgEventStream {
  private aborter: AbortController | null = null;
  private closed = false;
  private lastSeenRowID: number | null = null;

  constructor(
    private config: Config,
    private handlers: {
      onMessage: (msg: Message) => void;
      onOpen?: () => void;
      onError?: (err: Error) => void;
      onClose?: () => void;
    },
  ) {}

  async start(opts?: { chatId?: number; sinceRowID?: number }): Promise<void> {
    this.closed = false;
    if (opts?.sinceRowID != null) this.lastSeenRowID = opts.sinceRowID;
    // Loop lets us reconnect after a transport error. Each iteration opens a fresh
    // request, consumes until the stream ends, then waits `reconnectDelayMs` before the
    // next attempt.
    while (!this.closed) {
      try {
        await this.runOnce(opts?.chatId);
      } catch (err) {
        this.handlers.onError?.(err as Error);
      }
      if (this.closed) break;
      await new Promise((r) => setTimeout(r, this.config.reconnectDelayMs));
    }
    this.handlers.onClose?.();
  }

  private async runOnce(chatId?: number): Promise<void> {
    this.aborter = new AbortController();
    const params = new URLSearchParams();
    if (chatId != null) params.set("chat_id", String(chatId));
    if (this.lastSeenRowID != null) params.set("since_rowid", String(this.lastSeenRowID));
    const base = this.config.server.replace(/\/+$/, "");
    const url = `${base}/api/events${params.toString() ? `?${params}` : ""}`;

    const headers = new Headers(this.config.customHeaders);
    headers.set("Accept", "text/event-stream");
    if (this.config.token) headers.set("Authorization", `Bearer ${this.config.token}`);

    const res = await fetch(url, { headers, signal: this.aborter.signal });
    if (!res.ok || !res.body) {
      throw new Error(`SSE ${res.status}: ${await res.text().catch(() => "")}`);
    }
    this.handlers.onOpen?.();

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      // SSE event blocks are separated by blank lines (\n\n). Everything before the last
      // \n\n is a complete block; anything after is partial and gets saved for the next
      // iteration.
      let blockBoundary = buffer.indexOf("\n\n");
      while (blockBoundary !== -1) {
        const block = buffer.slice(0, blockBoundary);
        buffer = buffer.slice(blockBoundary + 2);
        this.parseBlock(block);
        blockBoundary = buffer.indexOf("\n\n");
      }
    }
  }

  private parseBlock(block: string): void {
    let event = "message";
    const dataLines: string[] = [];
    for (const rawLine of block.split("\n")) {
      if (rawLine.startsWith(":")) continue; // SSE comment / keep-alive
      const colon = rawLine.indexOf(":");
      if (colon === -1) continue;
      const field = rawLine.slice(0, colon);
      let value = rawLine.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") dataLines.push(value);
    }
    if (event !== "message" || dataLines.length === 0) return;
    try {
      const msg = JSON.parse(dataLines.join("\n")) as Message;
      if (typeof msg.id === "number") this.lastSeenRowID = msg.id;
      this.handlers.onMessage(msg);
    } catch {
      // Ignore malformed payloads; the server shouldn't send them but we'd rather stay
      // connected than crash the TUI.
    }
  }

  stop(): void {
    this.closed = true;
    this.aborter?.abort();
  }
}
