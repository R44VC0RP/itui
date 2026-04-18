import type { Config } from "../config.ts";
import type { ChatRow, Message } from "./types.ts";

export class APIError extends Error {
  constructor(
    public status: number,
    public url: string,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Thin wrapper around the imsg HTTP API. Every method returns typed data and throws
 * `APIError` with status + URL on non-2xx responses so the UI can distinguish between a
 * transport blip and a server-side problem.
 */
export class ImsgClient {
  constructor(private config: Config) {}

  private headers(): Headers {
    const h = new Headers(this.config.customHeaders);
    h.set("Accept", "application/json");
    if (this.config.token) h.set("Authorization", `Bearer ${this.config.token}`);
    return h;
  }

  /** Build an absolute URL from a relative API path. */
  url(path: string): string {
    const base = this.config.server.replace(/\/+$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  }

  async listChats(limit = 40): Promise<ChatRow[]> {
    const url = this.url(`/api/chats?limit=${limit}`);
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new APIError(res.status, url, await res.text());
    const data = (await res.json()) as { chats: ChatRow[] };
    return data.chats;
  }

  async listMessages(chatId: number, limit = 80): Promise<Message[]> {
    const url = this.url(`/api/chats/${chatId}/messages?limit=${limit}`);
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new APIError(res.status, url, await res.text());
    const data = (await res.json()) as { messages: Message[] };
    return data.messages;
  }

  async send(opts: {
    to?: string;
    chatId?: number;
    chatGuid?: string;
    chatIdentifier?: string;
    text: string;
  }): Promise<void> {
    const url = this.url("/api/send");
    const body: Record<string, unknown> = { text: opts.text };
    if (opts.to) body.to = opts.to;
    if (opts.chatId != null) body.chat_id = opts.chatId;
    if (opts.chatGuid) body.chat_guid = opts.chatGuid;
    if (opts.chatIdentifier) body.chat_identifier = opts.chatIdentifier;
    const headers = this.headers();
    headers.set("Content-Type", "application/json");
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new APIError(res.status, url, await res.text());
  }

  /** Probe the server so we can show a clear error if the URL is wrong / unreachable. */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(this.url("/api/chats?limit=1"), {
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
