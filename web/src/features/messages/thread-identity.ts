import type {
  ChatRow,
  Message as ImsgMessage,
  ResolvedContact,
} from "@/lib/imsg"
import type { ThreadSummary } from "@/features/messages/types"
import { handlesMatch, threadService } from "@/features/messages/utils"

const resolvedParticipants = (chat: ChatRow) => chat.participants_resolved ?? []

const uniqueNonEmptyValues = (values: string[]) =>
  values.filter(
    (value, index, current) => value.length > 0 && current.indexOf(value) === index
  )

const meaningfulChatName = (chat: ChatRow) => {
  const trimmed = chat.name.trim()

  if (!trimmed) {
    return null
  }

  if (handlesMatch(trimmed, chat.identifier)) {
    return null
  }

  if (chat.participants.some((handle) => handlesMatch(trimmed, handle))) {
    return null
  }

  return trimmed
}

const participantValues = (chat: ChatRow) =>
  uniqueNonEmptyValues(
    resolvedParticipants(chat)
      .map(displayNameForContact)
      .map((value) => value.trim())
  )

const participantLabel = (chat: ChatRow, limit = 2) => {
  const values = participantValues(chat)

  if (values.length === 0) {
    const handles = uniqueNonEmptyValues(
      chat.participants.map((value) => value.trim()).filter(Boolean)
    )

    if (handles.length === 0) {
      return null
    }

    if (handles.length <= limit) {
      return handles.join(", ")
    }

    return `${handles.slice(0, limit).join(", ")} +${handles.length - limit}`
  }

  if (values.length <= limit) {
    return values.join(", ")
  }

  return `${values.slice(0, limit).join(", ")} +${values.length - limit}`
}

export const displayNameForContact = (contact: ResolvedContact) =>
  contact.name?.trim() || contact.handle

export const avatarSourceForContact = (contact?: ResolvedContact) => {
  if (!contact) {
    return undefined
  }

  const avatarURL = contact.avatar_url?.trim()
  if (avatarURL) {
    return avatarURL
  }

  if (contact.avatar_base64 && contact.avatar_mime) {
    return `data:${contact.avatar_mime};base64,${contact.avatar_base64}`
  }

  return undefined
}

const primaryResolvedParticipant = (chat: ChatRow) =>
  resolvedParticipants(chat).find(
    (contact) => contact.name?.trim() || contact.avatar_url || contact.avatar_base64
  ) ?? resolvedParticipants(chat)[0]

export const threadContact = (chat: ChatRow) =>
  chat.is_group ? undefined : primaryResolvedParticipant(chat)

export const threadAvatarContacts = (chat: ChatRow) => {
  if (chat.is_group) {
    return resolvedParticipants(chat).slice(0, 2)
  }

  const contact = threadContact(chat)
  return contact ? [contact] : []
}

export const threadAvatarOverflowCount = (chat: ChatRow) => {
  if (!chat.is_group) {
    return 0
  }

  return Math.max(0, resolvedParticipants(chat).length - threadAvatarContacts(chat).length)
}

export const threadTitle = (chat: ChatRow) => {
  const contact = threadContact(chat)
  const explicitName = meaningfulChatName(chat)
  const participants = participantValues(chat)

  if (chat.is_group) {
    if (explicitName) {
      return explicitName
    }

    if (participants.length > 0) {
      return participants.join(", ")
    }

    return chat.identifier || "Conversation"
  }

  if (contact?.name?.trim()) {
    return contact.name.trim()
  }

  if (explicitName) {
    return explicitName
  }

  if (participants.length > 0) {
    return participants[0]!
  }

  return primaryResolvedParticipant(chat)?.handle || chat.identifier || "Unknown"
}

export const threadSubtitle = (chat: ChatRow) => {
  if (!chat.is_group) {
    return threadContact(chat)?.handle || chat.participants[0] || chat.identifier
  }

  const explicitName = meaningfulChatName(chat)
  const participantSummary = participantLabel(chat)
  const participantCount = Math.max(
    resolvedParticipants(chat).length,
    chat.participants.length
  )

  if (explicitName && participantSummary) {
    return participantSummary
  }

  if (participantCount > 0) {
    return participantCount === 1
      ? "1 participant"
      : `${participantCount} participants`
  }

  return "Group conversation"
}

export const threadFallbackPreview = (chat: ChatRow) => {
  const contact = threadContact(chat)

  if (contact?.handle) {
    return contact.handle
  }

  return chat.identifier || "Conversation"
}

export const primaryHandleForChat = (chat: ChatRow) =>
  primaryResolvedParticipant(chat)?.handle || chat.participants[0] || chat.identifier

export const buildThreadSummary = (chat: ChatRow, unreadCount: number): ThreadSummary => {
  const title = threadTitle(chat)
  const subtitle = threadSubtitle(chat)
  const contact = threadContact(chat)
  const resolvedPreview = chat.preview || threadFallbackPreview(chat)
  const participantContacts = resolvedParticipants(chat)
  const participantSearch = resolvedParticipants(chat)
    .flatMap((participant) => [participant.handle, participant.name ?? ""])
    .join(" ")

  const searchText = [
    title,
    subtitle,
    resolvedPreview,
    chat.identifier,
    participantSearch,
  ]
    .join(" ")
    .toLowerCase()

  return {
    avatarContacts: threadAvatarContacts(chat),
    avatarOverflowCount: threadAvatarOverflowCount(chat),
    contact,
    guid: chat.guid,
    id: chat.id,
    identifier: chat.identifier,
    isGroup: chat.is_group,
    lastActivity: chat.last_message_at,
    participantContacts,
    participantHandles: chat.participants,
    primaryHandle: primaryHandleForChat(chat),
    preview: resolvedPreview,
    searchText,
    service: threadService(chat.service),
    subtitle,
    title,
    unreadCount,
  }
}

export const senderDisplayName = (message: ImsgMessage) =>
  message.sender_contact ? displayNameForContact(message.sender_contact) : message.sender
