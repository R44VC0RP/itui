import type { Message as ImsgMessage, ResolvedContact } from "@/lib/imsg"

export type ConnectionState = "connecting" | "online" | "offline"
export type ThreadService = "auto" | "imessage" | "rcs" | "sms"
export type ComposerAttachmentKind = "image" | "video" | "audio" | "file"
export type ComposerAttachmentState =
  | "queued"
  | "uploading"
  | "sending"
  | "failed"
export type ComposerSendPhase = "idle" | "uploading" | "sending"

export type ThreadSummary = {
  avatarContacts: ResolvedContact[]
  avatarOverflowCount: number
  contact?: ResolvedContact
  guid: string
  id: number
  identifier: string
  isGroup: boolean
  lastActivity: string
  participantContacts: ResolvedContact[]
  participantHandles: string[]
  primaryHandle: string
  preview: string
  searchText: string
  service: ThreadService
  subtitle: string
  title: string
  unreadCount: number
}

export type DraftConversation = {
  avatarContacts: ResolvedContact[]
  avatarOverflowCount: number
  contact?: ResolvedContact
  handle: string
  kind: "draft"
  participantContacts: ResolvedContact[]
  service: ThreadService
  subtitle: string
  title: string
}

export type ActiveConversation =
  | ({ kind: "thread" } & ThreadSummary)
  | DraftConversation

export type ComposeOption = {
  avatarContacts: ResolvedContact[]
  avatarOverflowCount: number
  contact?: ResolvedContact
  handle: string
  isExistingThread: boolean
  isManual: boolean
  key: string
  participantContacts: ResolvedContact[]
  service: ThreadService
  subtitle: string
  threadId?: number
  title: string
}

export type ConversationMessageDeliveryState = "sending" | "failed"

export type ComposerAttachment = {
  errorMessage?: string
  file: File
  id: string
  kind: ComposerAttachmentKind
  name: string
  previewUrl?: string
  size: number
  status: ComposerAttachmentState
}

export type LocalConversationMessagePayload = {
  attachments: ComposerAttachment[]
  text: string
}

export type ConversationMessage = ImsgMessage & {
  clientId?: string
  deliveryError?: string
  deliveryState?: ConversationMessageDeliveryState
  localPayload?: LocalConversationMessagePayload
}
