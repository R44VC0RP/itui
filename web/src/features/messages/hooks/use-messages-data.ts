import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { ChatRow, Message as ImsgMessage } from "@/lib/imsg"
import type {
  ConnectionState,
  ConversationMessage,
  ConversationMessageDeliveryState,
} from "@/features/messages/types"
import {
  applyChatActivity,
  applyIncomingConversationMessage,
  mergeLoadedMessages,
  releaseConversationMessageAssets,
  sortConversationMessages,
  updateConversationMessageDelivery,
} from "@/features/messages/conversation-messages"
import { buildThreadSummary } from "@/features/messages/thread-identity"
import { MessagesService } from "@/features/messages/services/messages-service"
import {
  describeError,
  findThreadByHandle,
  previewSummary,
} from "@/features/messages/utils"
import { rankThreads } from "@/features/messages/search"

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

export function useMessagesData({
  draftConversationHandle,
  service,
}: {
  draftConversationHandle: string | null
  service: MessagesService
}) {
  const [chats, setChats] = useState<ChatRow[]>([])
  const [messagesByChat, setMessagesByChat] = useState<
    Record<number, ConversationMessage[]>
  >({})
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({})
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [loadingMessagesChatId, setLoadingMessagesChatId] = useState<
    number | null
  >(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [backendReachable, setBackendReachable] = useState(false)
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting")
  const chatsRef = useRef<ChatRow[]>([])
  const fullMessageChatIdsRef = useRef(new Set<number>())
  const selectedThreadIdRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const deferredSearch = useDeferredValue(search)

  const updateChatMessages = useCallback(
    (
      chatId: number,
      updater: (
        current: ConversationMessage[]
      ) => ConversationMessage[]
    ) => {
      setMessagesByChat((current) => {
        const existing = current[chatId] ?? []
        const next = updater(existing)

        if (next === existing) {
          return current
        }

        releaseRemovedMessages(existing, next)

        return {
          ...current,
          [chatId]: next,
        }
      })
    },
    []
  )

  const replaceChats = useCallback((nextChats: ChatRow[]) => {
    startTransition(() => {
      setChats(nextChats)
      setBackendReachable(true)
      setIsLoadingChats(false)
      setLoadError(null)
    })
  }, [])

  const clearLoadError = useCallback(() => {
    setLoadError(null)
  }, [])

  const reportLoadError = useCallback((message: string) => {
    setLoadError(message)
  }, [])

  const reportBackendFailure = useCallback((message: string) => {
    setBackendReachable(false)
    setIsLoadingChats(false)
    setLoadError(message)
  }, [])

  const reconcileLoadedMessages = useCallback(
    (chatId: number, nextMessages: ImsgMessage[]) => {
      const lastMessage = nextMessages.at(-1)

      startTransition(() => {
        updateChatMessages(chatId, (current) =>
          mergeLoadedMessages(current, nextMessages)
        )

        if (lastMessage) {
          setChats((current) =>
            applyChatActivity(
              current,
              chatId,
              lastMessage.created_at,
              previewSummary(lastMessage)
            )
          )
        }

        setBackendReachable(true)
        setLoadError(null)
      })
    },
    [updateChatMessages]
  )

  const reloadChats = useCallback(async () => {
    try {
      const nextChats = await service.listChats(60)
      replaceChats(nextChats)
    } catch (error) {
      reportBackendFailure(describeError(error))
    }
  }, [replaceChats, reportBackendFailure, service])

  const refreshThreadMessages = useCallback(
    async (chatId: number) => {
      const nextMessages = await service.listMessages(chatId, 80)
      reconcileLoadedMessages(chatId, nextMessages)
    },
    [reconcileLoadedMessages, service]
  )

  const clearUnread = useCallback((threadId: number) => {
    setUnreadCounts((current) => {
      if (current[threadId] == null) {
        return current
      }

      const next = { ...current }
      delete next[threadId]
      return next
    })
  }, [])

  const selectThread = useCallback(
    (threadId: number) => {
      setSelectedThreadId(threadId)
      setIsSidebarOpen(false)
      clearUnread(threadId)
    },
    [clearUnread]
  )

  const clearSelectedThread = useCallback(() => {
    setSelectedThreadId(null)
  }, [])

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  const queueThreadLocalMessage = useCallback(
    (chatId: number, optimisticMessage: ConversationMessage) => {
      startTransition(() => {
        updateChatMessages(chatId, (current) => {
          if (
            optimisticMessage.clientId &&
            current.some(
              (message) => message.clientId === optimisticMessage.clientId
            )
          ) {
            return current
          }

          return sortConversationMessages([
            ...current,
            {
              ...optimisticMessage,
              chat_id: chatId,
            },
          ])
        })

        setChats((current) =>
          applyChatActivity(
            current,
            chatId,
            optimisticMessage.created_at,
            previewSummary(optimisticMessage)
          )
        )
      })
    },
    [updateChatMessages]
  )

  const updateThreadLocalMessage = useCallback(
    (
      chatId: number,
      clientId: string,
      state: ConversationMessageDeliveryState,
      error?: string
    ) => {
      startTransition(() => {
        updateChatMessages(chatId, (current) =>
          updateConversationMessageDelivery(current, clientId, state, error)
        )
      })
    },
    [updateChatMessages]
  )

  const handleIncomingMessage = useCallback(
    (message: ImsgMessage) => {
      const hasChat = chatsRef.current.some((chat) => chat.id === message.chat_id)

      startTransition(() => {
        updateChatMessages(message.chat_id, (current) =>
          applyIncomingConversationMessage(current, message)
        )

        if (hasChat) {
          setChats((current) =>
            applyChatActivity(
              current,
              message.chat_id,
              message.created_at,
              previewSummary(message)
            )
          )
        }

        if (
          !message.is_from_me &&
          selectedThreadIdRef.current !== message.chat_id
        ) {
          setUnreadCounts((current) => ({
            ...current,
            [message.chat_id]: (current[message.chat_id] ?? 0) + 1,
          }))
        }
      })

      if (!hasChat) {
        void reloadChats()
      }
    },
    [chatsRef, reloadChats, updateChatMessages]
  )

  const threads = useMemo(
    () => chats.map((chat) => buildThreadSummary(chat, unreadCounts[chat.id] ?? 0)),
    [chats, unreadCounts]
  )

  const draftMatchedThread = useMemo(
    () =>
      draftConversationHandle
        ? findThreadByHandle(threads, draftConversationHandle)
        : null,
    [draftConversationHandle, threads]
  )

  const resolvedSelectedThreadId =
    draftConversationHandle != null && draftMatchedThread == null
      ? null
      : (draftMatchedThread?.id ??
        (selectedThreadId != null &&
          threads.some((thread) => thread.id === selectedThreadId)
          ? selectedThreadId
          : (threads[0]?.id ?? null)))

  const selectedThread =
    resolvedSelectedThreadId == null
      ? null
      : (threads.find((thread) => thread.id === resolvedSelectedThreadId) ??
        null)

  const selectedThreadMessages = useMemo(() => {
    if (!selectedThread) {
      return []
    }

    return (messagesByChat[selectedThread.id] ?? []).filter(
      (message) => !message.is_reaction
    )
  }, [messagesByChat, selectedThread])

  const visibleThreads = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    if (!query) {
      return threads
    }

    return rankThreads(threads, query)
  }, [deferredSearch, threads])

  const isLoadingSelectedMessages =
    selectedThread != null &&
    loadingMessagesChatId === selectedThread.id &&
    messagesByChat[selectedThread.id] == null

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  useEffect(() => {
    selectedThreadIdRef.current = resolvedSelectedThreadId
  }, [resolvedSelectedThreadId])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const nextChats = await service.listChats(60)

        if (cancelled) {
          return
        }

        replaceChats(nextChats)
      } catch (error) {
        if (!cancelled) {
          reportBackendFailure(describeError(error))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [replaceChats, reportBackendFailure, service])

  useEffect(() => {
    if (resolvedSelectedThreadId == null) {
      return
    }

    if (fullMessageChatIdsRef.current.has(resolvedSelectedThreadId)) {
      return
    }

    const chatId = resolvedSelectedThreadId
    let cancelled = false
    setLoadingMessagesChatId(chatId)

    ;(async () => {
      try {
        const nextMessages = await service.listMessages(chatId, 80)

        if (cancelled) {
          fullMessageChatIdsRef.current.delete(chatId)
          return
        }

        fullMessageChatIdsRef.current.add(chatId)
        reconcileLoadedMessages(chatId, nextMessages)
      } catch (error) {
        fullMessageChatIdsRef.current.delete(chatId)
        if (!cancelled) {
          setLoadError(describeError(error))
        }
      } finally {
        if (!cancelled) {
          setLoadingMessagesChatId((current) =>
            current === chatId ? null : current
          )
        } else {
          fullMessageChatIdsRef.current.delete(chatId)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reconcileLoadedMessages, resolvedSelectedThreadId, service])

  return {
    backendReachable,
    chats,
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
    selectedThreadId: resolvedSelectedThreadId,
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
  }
}
