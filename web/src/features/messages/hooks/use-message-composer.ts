import { useCallback, useMemo, useState } from "react"

import type {
  ActiveConversation,
  ComposerAttachment,
  ConversationMessage,
} from "@/features/messages/types"
import { createOptimisticConversationMessage } from "@/features/messages/conversation-messages"
import { useComposerAttachments } from "@/features/messages/hooks/use-composer-attachments"
import { useDraftConversationMessages } from "@/features/messages/hooks/use-draft-conversation-messages"
import { MessagesService } from "@/features/messages/services/messages-service"
import { describeError } from "@/features/messages/utils"

type SendBatch = {
  attachments: ComposerAttachment[]
  text: string
}

type QueuedSendBatch = SendBatch & {
  clientId: string
}

const buildSendBatches = (
  text: string,
  attachments: ComposerAttachment[]
): SendBatch[] => {
  if (attachments.length === 0) {
    return [{ attachments: [], text }]
  }

  return attachments.map((attachment, index) => ({
    attachments: [attachment],
    text: index === 0 ? text : "",
  }))
}

const conversationHandle = (conversation: ActiveConversation) =>
  conversation.kind === "draft"
    ? conversation.handle
    : conversation.isGroup
      ? conversation.identifier
      : conversation.primaryHandle

export function useMessageComposer({
  activeConversation,
  onQueueThreadLocalMessage,
  onRefreshDraftConversation,
  onRefreshThreadMessages,
  onReportLoadError,
  onUpdateThreadLocalMessage,
  service,
}: {
  activeConversation: ActiveConversation | null
  onQueueThreadLocalMessage: (
    chatId: number,
    optimisticMessage: ConversationMessage
  ) => void
  onRefreshDraftConversation: (handle: string) => Promise<boolean>
  onRefreshThreadMessages: (chatId: number) => Promise<void>
  onReportLoadError: (message: string) => void
  onUpdateThreadLocalMessage: (
    chatId: number,
    clientId: string,
    state: "sending" | "failed",
    error?: string
  ) => void
  service: MessagesService
}) {
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const {
    appendDraftMessage,
    clearDraftMessages,
    draftMessagesByHandle,
    updateDraftMessage,
  } = useDraftConversationMessages()

  const updateLocalMessageState = useCallback(
    (
      conversation: ActiveConversation,
      clientId: string,
      state: "sending" | "failed",
      error?: string
    ) => {
      if (conversation.kind === "thread") {
        onUpdateThreadLocalMessage(conversation.id, clientId, state, error)
        return
      }

      updateDraftMessage(conversation.handle, clientId, state, error)
    },
    [onUpdateThreadLocalMessage, updateDraftMessage]
  )

  const queueLocalMessage = useCallback(
    (conversation: ActiveConversation, message: ConversationMessage) => {
      if (conversation.kind === "thread") {
        onQueueThreadLocalMessage(conversation.id, message)
        return
      }

      appendDraftMessage(conversation.handle, message)
    },
    [appendDraftMessage, onQueueThreadLocalMessage]
  )

  const composerAttachments = useComposerAttachments({
    activeConversation,
    isSending,
    onQueueFiles: () => {
      setSendError(null)
    },
  })
  const { resetAttachments } = composerAttachments

  const resetComposerState = useCallback(() => {
    setDraft("")
    setSendError(null)
    resetAttachments()
  }, [resetAttachments])

  const sendBatches = useMemo(() => {
    const normalizedText = draft.trim() ? draft : ""
    return buildSendBatches(normalizedText, composerAttachments.attachments)
  }, [composerAttachments.attachments, draft])

  const completeSuccessfulSend = useCallback(
    async (conversation: ActiveConversation) => {
      try {
        if (conversation.kind === "thread") {
          await onRefreshThreadMessages(conversation.id)
          return
        }

        const didResolve = await onRefreshDraftConversation(conversation.handle)

        if (didResolve) {
          clearDraftMessages(conversation.handle)
        }
      } catch (error) {
        onReportLoadError(describeError(error))
      }
    },
    [
      clearDraftMessages,
      onRefreshDraftConversation,
      onRefreshThreadMessages,
      onReportLoadError,
    ]
  )

  const sendQueuedBatches = useCallback(
    async (
      conversation: ActiveConversation,
      queuedBatches: QueuedSendBatch[]
    ) => {
      for (const [index, batch] of queuedBatches.entries()) {
        const baseTarget =
          conversation.kind === "thread"
            ? {
                chatGuid: conversation.guid,
                chatId: conversation.id,
                chatIdentifier: conversation.identifier,
              }
            : {
                service: conversation.service,
                to: conversation.handle,
              }

        try {
          if (batch.attachments.length === 0) {
            await service.send({
              ...baseTarget,
              text: batch.text,
            })
            continue
          }

          const attachment = batch.attachments[0]!

          const stagedUpload = await service.uploadAttachment(attachment.file)

          await service.send({
            ...baseTarget,
            text: batch.text,
            uploadId: stagedUpload.id,
          })
        } catch (error) {
          const errorMessage = describeError(error)
          queuedBatches
            .slice(index)
            .forEach((pendingBatch) => {
              updateLocalMessageState(
                conversation,
                pendingBatch.clientId,
                "failed",
                errorMessage
              )
            })
          setSendError(errorMessage)
          throw error
        }
      }

      setSendError(null)
      await completeSuccessfulSend(conversation)
    },
    [completeSuccessfulSend, service, updateLocalMessageState]
  )

  const onSend = useCallback(async () => {
    if (!activeConversation || isSending) {
      return
    }

    const batches = sendBatches.filter(
      (batch) => batch.text.trim() || batch.attachments.length > 0
    )

    if (batches.length === 0) {
      return
    }

    setIsSending(true)
    setSendError(null)

    const queuedBatches = batches.map((batch) => {
      const optimisticMessage = createOptimisticConversationMessage({
        attachments: batch.attachments,
        chatId: activeConversation.kind === "thread" ? activeConversation.id : undefined,
        handle: conversationHandle(activeConversation),
        text: batch.text,
      })

      queueLocalMessage(activeConversation, optimisticMessage)

      return {
        attachments: optimisticMessage.localPayload?.attachments ?? [],
        clientId: optimisticMessage.clientId ?? optimisticMessage.guid,
        text: optimisticMessage.localPayload?.text ?? optimisticMessage.text,
      }
    })

    setDraft("")
    resetAttachments()

    try {
      await sendQueuedBatches(activeConversation, queuedBatches)
    } catch {
      return
    } finally {
      setIsSending(false)
    }
  }, [
    activeConversation,
    isSending,
    queueLocalMessage,
    resetAttachments,
    sendBatches,
    sendQueuedBatches,
  ])

  const onRetryMessage = useCallback(
    async (message: ConversationMessage) => {
      if (!activeConversation || isSending || !message.clientId || !message.localPayload) {
        return
      }

      setIsSending(true)
      setSendError(null)
      updateLocalMessageState(activeConversation, message.clientId, "sending")

      try {
        await sendQueuedBatches(activeConversation, [
          {
            attachments: message.localPayload.attachments,
            clientId: message.clientId,
            text: message.localPayload.text,
          },
        ])
      } catch {
        return
      } finally {
        setIsSending(false)
      }
    },
    [activeConversation, isSending, sendQueuedBatches, updateLocalMessageState]
  )

  return {
    attachments: composerAttachments.attachments,
    clearDraftConversationMessages: clearDraftMessages,
    draft,
    draftMessagesByHandle,
    fileInputRef: composerAttachments.fileInputRef,
    isDragActive: composerAttachments.isDragActive,
    isSending,
    onAddAttachment: composerAttachments.onAddAttachment,
    onDragEnter: composerAttachments.onDragEnter,
    onDragLeave: composerAttachments.onDragLeave,
    onDragOver: composerAttachments.onDragOver,
    onDraftChange: setDraft,
    onDrop: composerAttachments.onDrop,
    onFileChange: composerAttachments.onFileChange,
    onPaste: composerAttachments.onPaste,
    onRemoveAttachment: composerAttachments.onRemoveAttachment,
    onRetryMessage,
    onSend,
    resetComposerState,
    sendError,
  }
}
