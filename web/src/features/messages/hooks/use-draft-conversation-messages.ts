import { startTransition, useCallback, useState } from "react"

import type {
  ConversationMessage,
  ConversationMessageDeliveryState,
} from "@/features/messages/types"
import {
  releaseConversationMessageAssets,
  updateConversationMessageDelivery,
} from "@/features/messages/conversation-messages"
import { normalizeHandle } from "@/features/messages/utils"

const releaseRemovedMessages = (
  previous: ConversationMessage[],
  next: ConversationMessage[]
) => {
  const nextClientIds = new Set(
    next.flatMap((message) => (message.clientId ? [message.clientId] : []))
  )

  previous.forEach((message) => {
    if (message.clientId && !nextClientIds.has(message.clientId)) {
      releaseConversationMessageAssets(message)
    }
  })
}

export function useDraftConversationMessages() {
  const [draftMessagesByHandle, setDraftMessagesByHandle] = useState<
    Record<string, ConversationMessage[]>
  >({})

  const updateDraftMessages = useCallback(
    (
      handle: string,
      updater: (
        current: ConversationMessage[]
      ) => ConversationMessage[]
    ) => {
      const handleKey = normalizeHandle(handle)

      startTransition(() => {
        setDraftMessagesByHandle((current) => {
          const existing = current[handleKey] ?? []
          const next = updater(existing)

          if (next === existing) {
            return current
          }

          releaseRemovedMessages(existing, next)

          return {
            ...current,
            [handleKey]: next,
          }
        })
      })
    },
    []
  )

  const clearDraftMessages = useCallback((handle: string) => {
    const handleKey = normalizeHandle(handle)

    setDraftMessagesByHandle((current) => {
      const existing = current[handleKey]
      if (existing == null) {
        return current
      }

      existing.forEach(releaseConversationMessageAssets)

      const next = {
        ...current,
      }
      delete next[handleKey]
      return next
    })
  }, [])

  const appendDraftMessage = useCallback(
    (handle: string, message: ConversationMessage) => {
      updateDraftMessages(handle, (current) => [...current, message])
    },
    [updateDraftMessages]
  )

  const updateDraftMessage = useCallback(
    (
      handle: string,
      clientId: string,
      state: ConversationMessageDeliveryState,
      error?: string
    ) => {
      updateDraftMessages(handle, (current) =>
        updateConversationMessageDelivery(current, clientId, state, error)
      )
    },
    [updateDraftMessages]
  )

  return {
    appendDraftMessage,
    clearDraftMessages,
    draftMessagesByHandle,
    updateDraftMessage,
  }
}
