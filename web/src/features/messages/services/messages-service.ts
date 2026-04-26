import {
  ImsgClient,
  ImsgEventStream,
  type ContactsList,
  type Message as ImsgMessage,
  type ChatRow,
  type StagedUpload,
} from "@/lib/imsg"

type EventStreamHandlers = {
  onClose?: () => void
  onError?: (error: Error) => void
  onMessage: (message: ImsgMessage) => void
  onOpen?: () => void
}

export class MessagesService {
  private client: ImsgClient

  constructor(client = new ImsgClient()) {
    this.client = client
  }

  listChats(limit = 60): Promise<ChatRow[]> {
    return this.client.listChats(limit)
  }

  listContacts(): Promise<ContactsList> {
    return this.client.listContacts()
  }

  listMessages(chatId: number, limit = 80): Promise<ImsgMessage[]> {
    return this.client.listMessages(chatId, { limit })
  }

  send(options: {
    chatGuid?: string
    chatId?: number
    chatIdentifier?: string
    service?: string
    text: string
    to?: string
    uploadId?: string
  }): Promise<void> {
    return this.client.send(options)
  }

  uploadAttachment(file: File): Promise<StagedUpload> {
    return this.client.uploadAttachment(file)
  }

  cancelStagedUpload(id: string): Promise<void> {
    return this.client.cancelStagedUpload(id)
  }

  createEventStream(
    handlers: EventStreamHandlers,
    reconnectDelayMs = 3_000
  ): ImsgEventStream {
    return new ImsgEventStream(handlers, reconnectDelayMs)
  }
}
