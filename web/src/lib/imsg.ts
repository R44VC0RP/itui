export interface ResolvedContact {
  handle: string
  name?: string
  initials: string
  has_avatar: boolean
  avatar_mime?: string
  avatar_path?: string
  avatar_url?: string
  avatar_base64?: string
  avatar_bytes: number
}

export interface ContactsList {
  authorization:
    | "authorized"
    | "denied"
    | "limited"
    | "not_determined"
    | "restricted"
  contacts: ResolvedContact[]
}

export interface ChatRow {
  id: number
  name: string
  identifier: string
  guid: string
  service: string
  last_message_at: string
  preview: string
  participants: string[]
  is_group: boolean
  participants_resolved?: ResolvedContact[]
}

export interface Attachment {
  id: number
  filename: string
  transfer_name: string
  uti: string
  mime_type: string
  total_bytes: number
  is_sticker: boolean
  original_path: string
  missing: boolean
  attachment_url?: string
  preview_url?: string
}

export interface StagedUpload {
  id: string
  filename: string
  mime_type: string
  total_bytes: number
}

export interface Reaction {
  id: number
  type: string
  emoji: string
  sender: string
  is_from_me: boolean
  created_at: string
}

export interface Message {
  id: number
  chat_id: number
  guid: string
  sender: string
  is_from_me: boolean
  text: string
  created_at: string
  balloon_bundle_id?: string
  attachments: Attachment[]
  reactions: Reaction[]
  destination_caller_id?: string
  reply_to_guid?: string
  thread_originator_guid?: string
  is_reaction?: boolean
  reaction_type?: string
  reaction_emoji?: string
  is_reaction_add?: boolean
  reacted_to_guid?: string
  sender_contact?: ResolvedContact
}

export class APIError extends Error {
  status: number
  url: string

  constructor(status: number, url: string, message: string) {
    super(message)
    this.name = "APIError"
    this.status = status
    this.url = url
  }
}

type MessageListOptions = {
  attachments?: boolean
  limit?: number
}

type SendMessageOptions = {
  chatGuid?: string
  chatId?: number
  chatIdentifier?: string
  file?: string
  service?: string
  text: string
  to?: string
  uploadId?: string
}

export class ImsgClient {
  private headers(): HeadersInit {
    return {
      Accept: "application/json",
    }
  }

  private async errorMessage(response: Response): Promise<string> {
    const raw = await response.text()

    if (!raw.trim()) {
      return response.statusText || "Request failed"
    }

    try {
      const payload = JSON.parse(raw) as {
        error?: string
        message?: string
      }
      return payload.error || payload.message || raw
    } catch {
      return raw
    }
  }

  private async assertOk(response: Response, url: string): Promise<void> {
    if (!response.ok) {
      throw new APIError(response.status, url, await this.errorMessage(response))
    }
  }

  url(path: string): string {
    return path.startsWith("/") ? path : `/${path}`
  }

  async listChats(limit = 40): Promise<ChatRow[]> {
    const params = new URLSearchParams({
      limit: String(limit),
    })
    const url = this.url(`/api/chats?${params}`)
    const response = await fetch(url, {
      headers: this.headers(),
    })

    await this.assertOk(response, url)

    const data = (await response.json()) as {
      chats: ChatRow[]
    }

    return data.chats
  }

  async listContacts(): Promise<ContactsList> {
    const url = this.url("/api/contacts")
    const response = await fetch(url, {
      headers: this.headers(),
    })

    await this.assertOk(response, url)

    return (await response.json()) as ContactsList
  }

  async listMessages(
    chatId: number,
    { attachments = true, limit = 80 }: MessageListOptions = {}
  ): Promise<Message[]> {
    const params = new URLSearchParams({
      limit: String(limit),
    })

    if (!attachments) {
      params.set("attachments", "0")
    }

    const url = this.url(`/api/chats/${chatId}/messages?${params}`)
    const response = await fetch(url, {
      headers: this.headers(),
    })

    await this.assertOk(response, url)

    const data = (await response.json()) as {
      messages: Message[]
    }

    return data.messages
  }

  async send(options: SendMessageOptions): Promise<void> {
    const url = this.url("/api/send")
    const response = await fetch(url, {
      body: JSON.stringify({
        chat_guid: options.chatGuid,
        chat_id: options.chatId,
        chat_identifier: options.chatIdentifier,
        file: options.file,
        service: options.service,
        text: options.text,
        to: options.to,
        upload_id: options.uploadId,
      }),
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    await this.assertOk(response, url)
  }

  async uploadAttachment(file: File): Promise<StagedUpload> {
    const params = new URLSearchParams({
      filename: file.name || "attachment",
    })
    const url = this.url(`/api/uploads?${params}`)
    const response = await fetch(url, {
      body: file,
      headers: {
        ...this.headers(),
        "Content-Type": file.type || "application/octet-stream",
      },
      method: "POST",
    })

    await this.assertOk(response, url)

    const data = (await response.json()) as {
      upload: StagedUpload
    }

    return data.upload
  }

  async cancelStagedUpload(id: string): Promise<void> {
    const url = this.url(`/api/uploads/${encodeURIComponent(id)}`)
    const response = await fetch(url, {
      headers: this.headers(),
      method: "DELETE",
    })

    await this.assertOk(response, url)
  }
}

type EventStreamOptions = {
  chatId?: number
  sinceRowId?: number
}

type EventStreamHandlers = {
  onClose?: () => void
  onError?: (error: Error) => void
  onMessage: (message: Message) => void
  onOpen?: () => void
}

export class ImsgEventStream {
  private aborter: AbortController | null = null
  private closed = false
  private handlers: EventStreamHandlers
  private lastSeenRowId: number | null = null
  private reconnectDelayMs: number

  constructor(handlers: EventStreamHandlers, reconnectDelayMs = 3_000) {
    this.handlers = handlers
    this.reconnectDelayMs = reconnectDelayMs
  }

  async start(options?: EventStreamOptions): Promise<void> {
    this.closed = false

    if (options?.sinceRowId != null) {
      this.lastSeenRowId = options.sinceRowId
    }

    while (!this.closed) {
      try {
        await this.runOnce(options?.chatId)
      } catch (error) {
        if (this.closed) {
          break
        }

        this.handlers.onError?.(error as Error)
      }

      if (this.closed) {
        break
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, this.reconnectDelayMs)
      )
    }

    this.handlers.onClose?.()
  }

  stop(): void {
    this.closed = true
    this.aborter?.abort()
  }

  private async runOnce(chatId?: number): Promise<void> {
    this.aborter = new AbortController()

    const params = new URLSearchParams()

    if (chatId != null) {
      params.set("chat_id", String(chatId))
    }

    if (this.lastSeenRowId != null) {
      params.set("since_rowid", String(this.lastSeenRowId))
    }

    const url = this.url(
      `/api/events${params.toString() ? `?${params.toString()}` : ""}`
    )
    const response = await fetch(url, {
      headers: {
        Accept: "text/event-stream",
      },
      signal: this.aborter.signal,
    })

    if (!response.ok || !response.body) {
      throw new APIError(response.status, url, await response.text())
    }

    this.handlers.onOpen?.()

    const reader = response.body.getReader()
    const decoder = new TextDecoder("utf-8")
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        return
      }

      buffer += decoder.decode(value, {
        stream: true,
      })

      let boundary = buffer.indexOf("\n\n")

      while (boundary !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        this.parseBlock(block)
        boundary = buffer.indexOf("\n\n")
      }
    }
  }

  private parseBlock(block: string): void {
    let event = "message"
    const dataLines: string[] = []

    for (const rawLine of block.split("\n")) {
      if (rawLine.startsWith(":")) {
        continue
      }

      const separator = rawLine.indexOf(":")

      if (separator === -1) {
        continue
      }

      const field = rawLine.slice(0, separator)
      let value = rawLine.slice(separator + 1)

      if (value.startsWith(" ")) {
        value = value.slice(1)
      }

      if (field === "event") {
        event = value
      } else if (field === "data") {
        dataLines.push(value)
      }
    }

    if (event !== "message" || dataLines.length === 0) {
      return
    }

    try {
      const message = JSON.parse(dataLines.join("\n")) as Message

      if (typeof message.id === "number") {
        this.lastSeenRowId = message.id
      }

      this.handlers.onMessage(message)
    } catch {
      // Ignore malformed events so the stream can stay alive.
    }
  }

  private url(path: string): string {
    return path.startsWith("/") ? path : `/${path}`
  }
}
