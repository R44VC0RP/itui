import type {
  Attachment as ImsgAttachment,
  Message as ImsgMessage,
  Reaction as ImsgReaction,
} from "@/lib/imsg"
import type {
  ComposerAttachment,
  ConversationMessage,
  ConversationMessageDeliveryState,
} from "@/features/messages/types"
import {
  attachmentKind,
  attachmentLabel,
  attachmentTitle,
  composerAttachmentKey,
  reactionSummary,
  toDate,
} from "@/features/messages/utils"

const nextLocalMessageId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `local-message-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const cloneComposerAttachmentForLocalMessage = (
  attachment: ComposerAttachment
): ComposerAttachment => ({
  ...attachment,
  errorMessage: undefined,
  previewUrl:
    attachment.kind === "image" ? URL.createObjectURL(attachment.file) : undefined,
  status: "queued",
})

const messageAttachmentFromComposerAttachment = (
  attachment: ComposerAttachment
): ImsgAttachment => ({
  attachment_url: attachment.previewUrl,
  filename: attachment.name,
  id: -1 * (Date.now() + Math.floor(Math.random() * 1000)),
  is_sticker: false,
  mime_type: attachment.file.type || "application/octet-stream",
  missing: false,
  original_path: "",
  total_bytes: attachment.size,
  transfer_name: attachment.name,
  uti: "",
})

const localAttachmentSignature = (attachments: ImsgAttachment[]) =>
  attachments
    .map((attachment) => `${attachmentKind(attachment)}:${attachmentTitle(attachment)}`)
    .join("|")

const localMessageSummary = (message: ImsgMessage) => {
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

const matchesOptimisticMessage = (
  candidate: ConversationMessage,
  incoming: ImsgMessage
) => {
  if (!candidate.clientId || candidate.is_from_me !== true || incoming.is_from_me !== true) {
    return false
  }

  if (candidate.chat_id !== incoming.chat_id) {
    return false
  }

  if (candidate.guid === incoming.guid) {
    return true
  }

  if (localMessageSummary(candidate) !== localMessageSummary(incoming)) {
    return false
  }

  if (
    localAttachmentSignature(candidate.attachments) !==
    localAttachmentSignature(incoming.attachments)
  ) {
    return false
  }

  return (
    Math.abs(
      toDate(candidate.created_at).getTime() - toDate(incoming.created_at).getTime()
    ) <
    1000 * 90
  )
}

const reactionFromEvent = (message: ImsgMessage): ImsgReaction | null => {
  if (!message.is_reaction || !message.reaction_emoji || !message.reaction_type) {
    return null
  }

  return {
    created_at: message.created_at,
    emoji: message.reaction_emoji,
    id: message.id,
    is_from_me: message.is_from_me,
    sender: message.sender,
    type: message.reaction_type,
  }
}

const applyReactionEvent = (
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

export const sortConversationMessages = (messages: ConversationMessage[]) =>
  [...messages].sort((left, right) => {
    const timeDiff =
      toDate(left.created_at).getTime() - toDate(right.created_at).getTime()

    if (timeDiff !== 0) {
      return timeDiff
    }

    return left.id - right.id
  })

export const createOptimisticConversationMessage = ({
  attachments = [],
  chatId,
  handle,
  text,
}: {
  attachments?: ComposerAttachment[]
  chatId?: number
  handle: string
  text: string
}): ConversationMessage => {
  const clientId = nextLocalMessageId()
  const localAttachments = attachments.map(cloneComposerAttachmentForLocalMessage)

  return {
    attachments: localAttachments.map(messageAttachmentFromComposerAttachment),
    // Draft conversations do not have a server chat id yet. Existing-thread callers
    // should pass chatId so optimistic messages can reconcile without extra mutation.
    chat_id: chatId ?? -1,
    clientId,
    created_at: new Date().toISOString(),
    deliveryError: undefined,
    deliveryState: "sending",
    destination_caller_id: undefined,
    guid: clientId,
    id: -1 * (Date.now() + Math.floor(Math.random() * 1000)),
    is_from_me: true,
    localPayload: {
      attachments: localAttachments,
      text,
    },
    reactions: [],
    sender: handle,
    text,
  }
}

export const releaseConversationMessageAssets = (message: ConversationMessage) => {
  message.localPayload?.attachments.forEach((attachment) => {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl)
    }
  })
}

export const updateConversationMessageDelivery = (
  messages: ConversationMessage[],
  clientId: string,
  state: ConversationMessageDeliveryState,
  error?: string
) => {
  let didChange = false

  const next = messages.map((message) => {
    if (message.clientId !== clientId) {
      return message
    }

    if (message.deliveryState === state && message.deliveryError === error) {
      return message
    }

    didChange = true
    return {
      ...message,
      deliveryError: error,
      deliveryState: state,
    }
  })

  return didChange ? next : messages
}

export const applyIncomingConversationMessage = (
  messages: ConversationMessage[],
  incoming: ImsgMessage
): ConversationMessage[] => {
  if (messages.some((candidate) => candidate.id === incoming.id)) {
    return messages
  }

  if (incoming.is_reaction && incoming.reacted_to_guid) {
    let updated = false
    const nextMessages = messages.map((candidate) => {
      if (candidate.guid !== incoming.reacted_to_guid) {
        return candidate
      }

      updated = true
      return {
        ...candidate,
        reactions: applyReactionEvent(candidate.reactions, incoming),
      }
    })

    return sortConversationMessages(
      updated ? [...nextMessages, incoming] : [...messages, incoming]
    )
  }

  const optimisticIndex = messages.findIndex((candidate) =>
    matchesOptimisticMessage(candidate, incoming)
  )

  if (optimisticIndex !== -1) {
    const next = [...messages]
    next[optimisticIndex] = incoming
    return sortConversationMessages(next)
  }

  return sortConversationMessages([...messages, incoming])
}

export const mergeLoadedMessages = (
  current: ConversationMessage[],
  loaded: ImsgMessage[]
) => {
  const nextServerMessages = sortConversationMessages([...loaded])
  const remainingLocalMessages = current.filter((message) => {
    if (!message.clientId) {
      return false
    }

    return !nextServerMessages.some((serverMessage) =>
      matchesOptimisticMessage(message, serverMessage)
    )
  })

  return sortConversationMessages([...nextServerMessages, ...remainingLocalMessages])
}

export const applyChatActivity = <
  T extends {
    id: number
    last_message_at: string
    preview: string
  },
>(
  chats: T[],
  chatId: number,
  createdAt: string,
  preview: string
) => {
  const index = chats.findIndex((chat) => chat.id === chatId)

  if (index === -1) {
    return chats
  }

  return [...chats]
    .map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            last_message_at: createdAt,
            preview,
          }
        : chat
    )
    .sort(
      (left, right) =>
        new Date(right.last_message_at).getTime() -
        new Date(left.last_message_at).getTime()
    )
}

export const compareComposerAttachments = (
  left: ComposerAttachment[],
  right: ComposerAttachment[]
) =>
  left.length === right.length &&
  left.every(
    (attachment, index) =>
      composerAttachmentKey(attachment.file) ===
      composerAttachmentKey(right[index]!.file)
  )
