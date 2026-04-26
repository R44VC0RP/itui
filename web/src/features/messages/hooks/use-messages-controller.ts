import { useCallback, useEffect, useMemo, useState } from "react"
import { parseAsInteger, useQueryState } from "nuqs"

import type { ActiveConversation, DraftConversation } from "@/features/messages/types"
import { useComposePicker } from "@/features/messages/hooks/use-compose-picker"
import { useMessageComposer } from "@/features/messages/hooks/use-message-composer"
import { useMessagesData } from "@/features/messages/hooks/use-messages-data"
import { useMessagesRealtime } from "@/features/messages/hooks/use-messages-realtime"
import { useThreadScrollManager } from "@/features/messages/hooks/use-thread-scroll-manager"
import { MessagesService } from "@/features/messages/services/messages-service"
import {
  describeError,
  findChatByHandle,
  messageCountLabel,
  normalizeHandle,
} from "@/features/messages/utils"

export function useMessagesController() {
  const service = useMemo(() => new MessagesService(), [])
  const [composeTarget, setComposeTarget] = useState<DraftConversation | null>(
    null
  )
  const [selectedChatParam, setSelectedChatParam] = useQueryState(
    "chat",
    parseAsInteger
  )
  const draftConversationHandle =
    selectedChatParam == null ? (composeTarget?.handle ?? null) : null

  const {
    backendReachable,
    clearLoadError,
    clearSelectedThread,
    closeSidebar,
    connectionState,
    handleIncomingMessage,
    isLoadingChats,
    isLoadingSelectedMessages,
    isSidebarOpen,
    loadError,
    queueThreadLocalMessage,
    reloadChats,
    replaceChats,
    reportBackendFailure,
    reportLoadError,
    refreshThreadMessages,
    scrollRef,
    search,
    selectedThread,
    selectedThreadId,
    selectedThreadIdRef,
    selectedThreadMessages,
    selectThread,
    setBackendReachable,
    setConnectionState,
    setIsSidebarOpen,
    setSearch,
    threads,
    updateThreadLocalMessage,
    visibleThreads,
  } = useMessagesData({
    draftConversationHandle,
    service,
  })

  const activeConversation: ActiveConversation | null =
    composeTarget != null &&
    draftConversationHandle != null &&
    selectedThread == null
      ? composeTarget
      : selectedThread
        ? {
            ...selectedThread,
            kind: "thread",
          }
        : null

  const refreshDraftConversation = useCallback(
    async (handle: string) => {
      try {
        const nextChats = await service.listChats(60)
        replaceChats(nextChats)

        const matchingChat = findChatByHandle(nextChats, handle)
        if (!matchingChat) {
          return false
        }

        void setSelectedChatParam(matchingChat.id, { history: "replace" })
        selectThread(matchingChat.id)
        setComposeTarget(null)
        return true
      } catch (error) {
        reportBackendFailure(describeError(error))
        throw error
      }
    },
    [
      replaceChats,
      reportBackendFailure,
      selectThread,
      service,
      setSelectedChatParam,
    ]
  )

  const composer = useMessageComposer({
    activeConversation,
    onQueueThreadLocalMessage: queueThreadLocalMessage,
    onRefreshDraftConversation: refreshDraftConversation,
    onRefreshThreadMessages: refreshThreadMessages,
    onReportLoadError: reportLoadError,
    onUpdateThreadLocalMessage: updateThreadLocalMessage,
    service,
  })

  const { draftMessagesByHandle, resetComposerState } = composer

  const handleSelectThread = useCallback(
    (threadId: number) => {
      if (selectedThreadId !== threadId) {
        void setSelectedChatParam(threadId, { history: "push" })
      }
      setComposeTarget(null)
      selectThread(threadId)
      resetComposerState()
    },
    [resetComposerState, selectThread, selectedThreadId, setSelectedChatParam]
  )

  const handleStartDraftConversation = useCallback(
    (conversation: DraftConversation) => {
      void setSelectedChatParam(null, { history: "replace" })
      setComposeTarget(conversation)
      clearSelectedThread()
      closeSidebar()
      clearLoadError()
      resetComposerState()
    },
    [
      clearLoadError,
      clearSelectedThread,
      closeSidebar,
      resetComposerState,
      setSelectedChatParam,
    ]
  )

  const composePicker = useComposePicker({
    onSelectExistingThread: handleSelectThread,
    onStartDraftConversation: handleStartDraftConversation,
    service,
    threads,
  })

  const resyncAfterReconnect = useCallback(async () => {
    await reloadChats()

    const chatId = selectedThreadIdRef.current
    if (chatId != null) {
      try {
        await refreshThreadMessages(chatId)
      } catch (error) {
        reportLoadError(describeError(error))
      }
    }
  }, [reloadChats, refreshThreadMessages, reportLoadError, selectedThreadIdRef])

  useMessagesRealtime({
    enabled: backendReachable,
    onIncomingMessage: handleIncomingMessage,
    onReachabilityChange: setBackendReachable,
    onReconnectResync: resyncAfterReconnect,
    onSetConnectionState: setConnectionState,
    service,
  })

  useEffect(() => {
    if (selectedChatParam == null) {
      return
    }

    if (selectedThreadId !== selectedChatParam) {
      selectThread(selectedChatParam)
    }
  }, [selectThread, selectedChatParam, selectedThreadId])

  useEffect(() => {
    if (selectedChatParam == null || threads.length === 0) {
      return
    }

    if (!threads.some((thread) => thread.id === selectedChatParam)) {
      void setSelectedChatParam(null, { history: "replace" })
    }
  }, [selectedChatParam, setSelectedChatParam, threads])

  const selectedMessages =
    composeTarget != null &&
    draftConversationHandle != null &&
    selectedThread == null
    ? (draftMessagesByHandle[normalizeHandle(composeTarget.handle)] ?? [])
    : selectedThreadMessages

  const activeConversationKey =
    activeConversation == null
      ? "none"
      : activeConversation.kind === "draft"
        ? `draft:${activeConversation.handle}`
        : `thread:${activeConversation.id}`

  useThreadScrollManager({
    conversationKey: activeConversationKey,
    isLoading: isLoadingSelectedMessages,
    messageCount: selectedMessages.length,
    scrollRef,
  })

  const headerStatus = (() => {
    if (!activeConversation) {
      return isLoadingChats ? "Loading conversations" : "No conversation selected"
    }

    if (activeConversation.kind === "draft") {
      return selectedMessages.length > 0
        ? `${messageCountLabel(selectedMessages.length)} · New conversation`
        : "New conversation"
    }

    if (isLoadingSelectedMessages) {
      return "Loading conversation"
    }

    const effectiveConnectionState = backendReachable
      ? connectionState
      : isLoadingChats
        ? "connecting"
        : "offline"

    if (effectiveConnectionState === "offline") {
      return "Disconnected. Retrying…"
    }

    if (
      effectiveConnectionState === "connecting" &&
      selectedMessages.length === 0
    ) {
      return "Connecting…"
    }

    return selectedMessages.length > 0
      ? messageCountLabel(selectedMessages.length)
      : "No messages yet"
  })()

  const { onOpenCompose, ...composePickerDialog } = composePicker

  return {
    activeConversation,
    composePicker: composePickerDialog,
    composer,
    conversation: {
      headerStatus,
      isLoadingChats,
      isLoadingSelectedMessages,
      loadError,
      onRetryMessage: composer.onRetryMessage,
      scrollRef,
      selectedMessages,
    },
    onOpenCompose,
    onSetSidebarOpen: setIsSidebarOpen,
    sidebar: {
      isOpen: isSidebarOpen,
      isLoading: isLoadingChats,
      onSearchChange: setSearch,
      onSelectThread: handleSelectThread,
      search,
      selectedThreadId,
      visibleThreads,
    },
  }
}
