import { useEffect, useRef } from "react"

import type { ConnectionState } from "@/features/messages/types"
import { MessagesService } from "@/features/messages/services/messages-service"
import type { Message as ImsgMessage } from "@/lib/imsg"

export function useMessagesRealtime({
  enabled,
  onIncomingMessage,
  onReachabilityChange,
  onReconnectResync,
  onSetConnectionState,
  service,
}: {
  enabled: boolean
  onIncomingMessage: (message: ImsgMessage) => void
  onReachabilityChange: (reachable: boolean) => void
  onReconnectResync: () => Promise<void>
  onSetConnectionState: (state: ConnectionState) => void
  service: MessagesService
}) {
  const hasStreamOpenedRef = useRef(false)
  const intentionalStopRef = useRef(false)
  const needsStreamResyncRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const stream = service.createEventStream(
      {
        onClose: () => {
          if (!intentionalStopRef.current) {
            needsStreamResyncRef.current = hasStreamOpenedRef.current
          }
          onSetConnectionState("offline")
        },
        onError: () => {
          if (!intentionalStopRef.current) {
            needsStreamResyncRef.current = true
          }
          onSetConnectionState("offline")
        },
        onMessage: onIncomingMessage,
        onOpen: () => {
          const shouldResync =
            !intentionalStopRef.current &&
            (hasStreamOpenedRef.current || needsStreamResyncRef.current)
          hasStreamOpenedRef.current = true
          needsStreamResyncRef.current = false
          onReachabilityChange(true)
          onSetConnectionState("online")

          if (shouldResync) {
            void onReconnectResync()
          }
        },
      },
      3_000
    )

    intentionalStopRef.current = false
    void stream.start()

    return () => {
      intentionalStopRef.current = true
      hasStreamOpenedRef.current = false
      needsStreamResyncRef.current = false
      stream.stop()
    }
  }, [
    enabled,
    onIncomingMessage,
    onReachabilityChange,
    onReconnectResync,
    onSetConnectionState,
    service,
  ])
}
