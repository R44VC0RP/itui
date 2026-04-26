import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

const bottomThreshold = 40

const isNearBottom = (element: HTMLElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= bottomThreshold

const snapToBottom = (element: HTMLElement) => {
  element.scrollTop = element.scrollHeight
}

export function useThreadScrollManager({
  conversationKey,
  isLoading,
  messageCount,
  scrollRef,
}: {
  conversationKey: string
  isLoading: boolean
  messageCount: number
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const pendingThreadSnapRef = useRef<string | null>(conversationKey)
  const previousConversationKeyRef = useRef(conversationKey)
  const previousMessageCountRef = useRef(messageCount)
  const shouldStickToBottomRef = useRef(true)

  useLayoutEffect(() => {
    const element = scrollRef.current

    if (!element) {
      return
    }

    if (previousConversationKeyRef.current !== conversationKey) {
      previousConversationKeyRef.current = conversationKey
      previousMessageCountRef.current = messageCount
      pendingThreadSnapRef.current = conversationKey
      shouldStickToBottomRef.current = true
    }

    const messageCountChanged = previousMessageCountRef.current !== messageCount
    previousMessageCountRef.current = messageCount

    if (pendingThreadSnapRef.current === conversationKey) {
      snapToBottom(element)

      if (!isLoading) {
        pendingThreadSnapRef.current = null
      }

      return
    }

    if (messageCountChanged && shouldStickToBottomRef.current) {
      snapToBottom(element)
    }
  }, [conversationKey, isLoading, messageCount, scrollRef])

  useEffect(() => {
    const element = scrollRef.current

    if (!element) {
      return
    }

    const updateStickiness = () => {
      shouldStickToBottomRef.current = isNearBottom(element)
    }

    updateStickiness()
    element.addEventListener("scroll", updateStickiness, { passive: true })

    return () => {
      element.removeEventListener("scroll", updateStickiness)
    }
  }, [conversationKey, scrollRef])

  useEffect(() => {
    const element = scrollRef.current
    const content = element?.firstElementChild

    if (!element || !content || typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(() => {
      if (
        pendingThreadSnapRef.current === conversationKey ||
        shouldStickToBottomRef.current
      ) {
        snapToBottom(element)

        if (!isLoading) {
          pendingThreadSnapRef.current = null
        }
      }
    })

    observer.observe(content)

    return () => {
      observer.disconnect()
    }
  }, [conversationKey, isLoading, messageCount, scrollRef])
}
