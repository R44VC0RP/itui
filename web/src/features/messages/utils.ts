import {
  APIError,
  type Attachment as ImsgAttachment,
  type ChatRow,
  type Message as ImsgMessage,
  type Reaction as ImsgReaction,
} from "@/lib/imsg"

import type {
  ComposerAttachment,
  ComposerAttachmentKind,
  ThreadService,
  ThreadSummary,
} from "@/features/messages/types"

const sidebarTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const dateLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})

const urlPattern = /https?:\/\/[^\s<>()]+/gi
const urlBalloonProvider = "com.apple.messages.URLBalloonProvider"
const browserUnsupportedImageMimeTypes = new Set([
  "image/heic",
  "image/heics",
  "image/heif",
  "image/heifs",
  "image/heic-sequence",
  "image/heif-sequence",
])
const browserInlineVideoMimeTypes = new Set([
  "video/mp4",
  "video/ogg",
  "video/webm",
  "video/x-m4v",
])
const browserInlineVideoExtensions = new Set(["m4v", "mp4", "ogg", "webm"])
const generatedAttachmentNamePattern = /^[0-9a-f]{8,}(?:-[0-9a-f]{2,})*$/i

export const normalizeHandle = (value: string) => {
  const trimmed = value.trim().toLowerCase()

  if (!trimmed) {
    return ""
  }

  if (trimmed.includes("@")) {
    return trimmed
  }

  return trimmed.replace(/[^\d+]/g, "")
}

export const handlesMatch = (left: string, right: string) =>
  normalizeHandle(left) !== "" && normalizeHandle(left) === normalizeHandle(right)

export const isHandleLike = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    return false
  }

  if (trimmed.includes("@")) {
    return true
  }

  return trimmed.replace(/\D/g, "").length >= 3
}

export const toDate = (value: number | string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return new Date()
  }

  return date
}

export const formatThreadTime = (timestamp: string) => {
  const date = toDate(timestamp)
  const today = new Date()

  if (date.toDateString() === today.toDateString()) {
    return sidebarTime.format(date)
  }

  return dateLabel.format(date)
}

export const formatMessageTime = (timestamp: string) =>
  sidebarTime.format(toDate(timestamp))

export const formatDayDivider = (timestamp: string) => {
  const date = toDate(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return "Today"
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday"
  }

  return dateLabel.format(date)
}

export const threadService = (service: string): ThreadService =>
  service.toLowerCase().includes("rcs")
    ? "rcs"
    : service.toLowerCase().includes("sms")
      ? "sms"
      : "imessage"

export const draftServiceForHandle = (handle: string): ThreadService =>
  handle.trim().includes("@") ? "imessage" : "auto"

export const sameBubbleGroup = (left: ImsgMessage, right?: ImsgMessage) => {
  if (!right) {
    return false
  }

  return (
    left.is_from_me === right.is_from_me &&
    (left.is_from_me
      ? true
      : handlesMatch(left.sender, right.sender) || left.sender === right.sender) &&
    Math.abs(
      toDate(left.created_at).getTime() - toDate(right.created_at).getTime()
    ) <
      1000 * 60 * 6 &&
    toDate(left.created_at).toDateString() ===
      toDate(right.created_at).toDateString()
  )
}

export const initialsFor = (title: string) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

export const attachmentLabel = (message: ImsgMessage) => {
  if (message.attachments.length === 0) {
    return "Attachment"
  }

  if (message.attachments.length > 1) {
    return `${message.attachments.length} attachments`
  }

  const attachment = message.attachments[0]!
  const transferName = attachment.transfer_name.trim()

  if (transferName) {
    return transferName
  }

  if (attachment.mime_type.startsWith("image/")) {
    return "Photo"
  }

  if (attachment.mime_type.startsWith("video/")) {
    return "Video"
  }

  if (attachment.mime_type.startsWith("audio/")) {
    return "Audio message"
  }

  return "Attachment"
}

export const reactionSummary = (message: ImsgMessage) => {
  const emoji = message.reaction_emoji?.trim()

  if (message.is_reaction_add === false) {
    return emoji ? `Removed ${emoji}` : "Removed a reaction"
  }

  if (emoji) {
    return `Reacted with ${emoji}`
  }

  return "Reacted to a message"
}

export const messageSummary = (message: ImsgMessage) => {
  const text = message.text.trim()

  if (text) {
    return text
  }

  if (message.is_reaction) {
    return reactionSummary(message)
  }

  if (message.attachments.length > 0) {
    return attachmentLabel(message)
  }

  return "Message"
}

export const previewSummary = (message: ImsgMessage) =>
  message.is_from_me ? `You: ${messageSummary(message)}` : messageSummary(message)

export const messageCountLabel = (count: number) =>
  count === 1 ? "1 message" : `${count} messages`

export const outgoingBubbleClass = (service: ThreadService) =>
  service === "sms"
    ? "bg-[var(--message-sms)] text-white"
    : service === "rcs"
      ? "bg-[var(--message-rcs)] text-white"
    : service === "auto"
      ? "bg-muted text-foreground"
      : "bg-[var(--message-imessage)] text-white"

export const composerPlaceholder = (service: ThreadService) =>
  service === "sms" || service === "rcs"
    ? "Text Message"
    : service === "auto"
      ? "Message"
      : "iMessage"

export const threadServiceLabel = (service: ThreadService) =>
  service === "sms"
    ? "SMS"
    : service === "rcs"
      ? "RCS"
      : service === "auto"
        ? "Message"
        : "iMessage"

export const messageURLs = (text: string) => {
  const matches = text.match(urlPattern) ?? []
  return matches.filter(
    (value, index, current) => current.indexOf(value) === index
  )
}

export const firstMessageURL = (message: ImsgMessage) => messageURLs(message.text)[0]

export const isURLBalloonMessage = (message: ImsgMessage) =>
  message.balloon_bundle_id === urlBalloonProvider && messageURLs(message.text).length > 0

export const attachmentDownloadHref = (attachment: ImsgAttachment) =>
  attachment.attachment_url || undefined

export const attachmentPreviewHref = (attachment: ImsgAttachment) =>
  attachment.preview_url || undefined

export const attachmentDisplayHref = (attachment: ImsgAttachment) =>
  attachment.preview_url || attachment.attachment_url || undefined

const fallbackAttachmentTitle = (attachment: ImsgAttachment) => {
  if (attachment.is_sticker) {
    return attachment.mime_type.startsWith("image/")
      ? "Sticker"
      : "Sticker response"
  }

  if (attachment.mime_type.startsWith("image/")) {
    return "Photo"
  }

  if (attachment.mime_type.startsWith("video/")) {
    return "Video"
  }

  if (attachment.mime_type.startsWith("audio/")) {
    return "Audio message"
  }

  return "Attachment"
}

const sanitizedAttachmentName = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const basename = trimmed.split(/[\\/]/).at(-1) || trimmed
  const stem = basename.replace(/\.[^.]+$/, "")

  return generatedAttachmentNamePattern.test(stem) ? null : basename
}

export const attachmentTitle = (attachment: ImsgAttachment) => {
  return (
    sanitizedAttachmentName(attachment.transfer_name) ||
    sanitizedAttachmentName(attachment.filename) ||
    fallbackAttachmentTitle(attachment)
  )
}

export const formatAttachmentBytes = (bytes: number) => {
  if (bytes <= 0) {
    return null
  }

  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const fractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`
}

export const attachmentKindFromMime = (
  mimeType: string
): ComposerAttachmentKind => {
  const mime = mimeType.toLowerCase()

  if (mime.startsWith("image/") && !browserUnsupportedImageMimeTypes.has(mime)) {
    return "image"
  }

  if (mime.startsWith("video/")) {
    return "video"
  }

  if (mime.startsWith("audio/")) {
    return "audio"
  }

  return "file"
}

export const attachmentKind = (attachment: ImsgAttachment) =>
  attachmentKindFromMime(attachment.mime_type) === "file" &&
  attachment.mime_type.toLowerCase().startsWith("image/") &&
  attachmentPreviewHref(attachment)
    ? "image"
    : attachmentKindFromMime(attachment.mime_type)

export const attachmentCanRenderInlineVideo = (attachment: ImsgAttachment) => {
  const mime = attachment.mime_type.toLowerCase()
  const extension = attachmentTitle(attachment).split(".").at(-1)?.toLowerCase() ?? ""

  return (
    browserInlineVideoMimeTypes.has(mime) ||
    browserInlineVideoExtensions.has(extension)
  )
}

export const attachmentDetail = (attachment: ImsgAttachment) => {
  const parts = [formatAttachmentBytes(attachment.total_bytes)].filter(Boolean)

  if (attachment.missing) {
    parts.unshift("Unavailable")
  } else if (attachment.is_sticker) {
    parts.unshift("Sticker")
  }

  return parts.join(" · ")
}

const reactionFromEvent = (message: ImsgMessage): ImsgReaction | null => {
  if (!message.is_reaction || !message.reaction_emoji || !message.reaction_type) {
    return null
  }

  return {
    id: message.id,
    type: message.reaction_type,
    emoji: message.reaction_emoji,
    sender: message.sender,
    is_from_me: message.is_from_me,
    created_at: message.created_at,
  }
}

export const applyReactionEvent = (
  reactions: ImsgReaction[],
  message: ImsgMessage
): ImsgReaction[] => {
  const reaction = reactionFromEvent(message)

  if (!reaction) {
    return reactions
  }

  if (message.is_reaction_add === false) {
    return reactions.filter(
      (candidate) =>
        !(
          candidate.sender === reaction.sender &&
          candidate.emoji === reaction.emoji &&
          candidate.type === reaction.type
        )
    )
  }

  const deduped = reactions.filter(
    (candidate) =>
      !(
        candidate.sender === reaction.sender &&
        candidate.emoji === reaction.emoji &&
        candidate.type === reaction.type
      )
  )

  return [...deduped, reaction].sort(
    (left, right) =>
      toDate(left.created_at).getTime() - toDate(right.created_at).getTime()
  )
}

export type GroupedReaction = {
  count: number
  emoji: string
  isFromMe: boolean
  label: string
}

export const groupedReactions = (
  reactions: ImsgReaction[]
): GroupedReaction[] => {
  const groups = new Map<
    string,
    {
      count: number
      emoji: string
      isFromMe: boolean
      senders: Set<string>
    }
  >()

  for (const reaction of reactions) {
    const key = reaction.emoji || reaction.type
    const existing = groups.get(key)

    if (existing) {
      existing.count += 1
      existing.isFromMe = existing.isFromMe || reaction.is_from_me
      existing.senders.add(reaction.sender)
      continue
    }

    groups.set(key, {
      count: 1,
      emoji: reaction.emoji || "•",
      isFromMe: reaction.is_from_me,
      senders: new Set([reaction.sender]),
    })
  }

  return Array.from(groups.values()).map((group) => ({
    count: group.count,
    emoji: group.emoji,
    isFromMe: group.isFromMe,
    label: Array.from(group.senders).join(", "),
  }))
}

export const findThreadByHandle = (threads: ThreadSummary[], handle: string) =>
  threads.find(
    (thread) =>
      !thread.isGroup &&
      (thread.participantHandles.some((candidate) =>
        handlesMatch(candidate, handle)
      ) || handlesMatch(thread.primaryHandle, handle))
  ) ?? null

export const findChatByHandle = (chats: ChatRow[], handle: string) =>
  chats.find(
    (chat) =>
      !chat.is_group &&
      chat.participants.some((candidate) => handlesMatch(candidate, handle))
  ) ?? null

export const createDraftMessage = (
  handle: string,
  text: string,
  attachments: ImsgAttachment[] = []
): ImsgMessage => ({
  attachments,
  chat_id: -1,
  created_at: new Date().toISOString(),
  destination_caller_id: undefined,
  guid: `draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  id: -1 * (Date.now() + Math.floor(Math.random() * 1000)),
  is_from_me: true,
  reactions: [],
  sender: handle,
  text,
})

const nextComposerAttachmentId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `attachment-${Date.now()}-${Math.floor(Math.random() * 1000)}`

export const composerAttachmentKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`

export const createComposerAttachment = (
  file: File
): ComposerAttachment => {
  const kind = attachmentKindFromMime(file.type)

  return {
    errorMessage: undefined,
    file,
    id: nextComposerAttachmentId(),
    kind,
    name: file.name || "Attachment",
    previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
    size: file.size,
    status: "queued",
  }
}

export const releaseComposerAttachment = (attachment: ComposerAttachment) => {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl)
  }
}

export const messageAttachmentFromComposerAttachment = (
  attachment: ComposerAttachment
): ImsgAttachment => ({
  id: -1 * (Date.now() + Math.floor(Math.random() * 1000)),
  filename: attachment.name,
  transfer_name: attachment.name,
  uti: "",
  mime_type: attachment.file.type || "application/octet-stream",
  total_bytes: attachment.size,
  is_sticker: false,
  original_path: "",
  missing: false,
  attachment_url: attachment.previewUrl,
  preview_url: attachment.previewUrl,
})

export const describeError = (error: unknown) => {
  if (error instanceof APIError) {
    const detail = error.message.trim()
    return detail ? `${error.status} ${detail}` : `${error.status} ${error.url}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
