import { describe, expect, it } from "vitest"

import type { Message } from "@/lib/imsg"
import {
  applyChatActivity,
  applyIncomingConversationMessage,
  createOptimisticConversationMessage,
  mergeLoadedMessages,
  updateConversationMessageDelivery,
} from "@/features/messages/conversation-messages"

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  attachments: [],
  chat_id: 1,
  created_at: "2026-04-17T12:00:00.000Z",
  guid: "message-1",
  id: 1,
  is_from_me: false,
  reactions: [],
  sender: "+15555550123",
  text: "Hello",
  ...overrides,
})

describe("conversation message reconciliation", () => {
  it("merges incoming reaction events into the target message", () => {
    const reactionEvent = makeMessage({
      created_at: "2026-04-17T12:01:00.000Z",
      guid: "reaction-1",
      id: 2,
      is_reaction: true,
      is_reaction_add: true,
      reacted_to_guid: "message-1",
      reaction_emoji: "❤️",
      reaction_type: "love",
      sender: "+15555550124",
      text: "",
    })

    const next = applyIncomingConversationMessage([makeMessage()], reactionEvent)
    const targetMessage = next.find((message) => message.guid === "message-1")

    expect(next).toHaveLength(2)
    expect(targetMessage?.reactions).toHaveLength(1)
    expect(targetMessage?.reactions[0]?.emoji).toBe("❤️")
  })

  it("replaces a matching optimistic local message when the server echo arrives", () => {
    const optimistic = createOptimisticConversationMessage({
      handle: "+15555550123",
      text: "Can you send the browser pass tonight?",
    })

    const incoming = makeMessage({
      chat_id: 42,
      created_at: optimistic.created_at,
      guid: "server-guid-42",
      id: 42,
      is_from_me: true,
      sender: "+15555550123",
      text: "Can you send the browser pass tonight?",
    })

    const next = applyIncomingConversationMessage(
      [{ ...optimistic, chat_id: 42 }],
      incoming
    )

    expect(next).toHaveLength(1)
    expect(next[0]?.guid).toBe("server-guid-42")
    expect(next[0]?.clientId).toBeUndefined()
  })

  it("uses the provided chat id for optimistic existing-thread messages", () => {
    const optimistic = createOptimisticConversationMessage({
      chatId: 42,
      handle: "+15555550123",
      text: "Already in this thread",
    })

    expect(optimistic.chat_id).toBe(42)
  })

  it("keeps failed local messages but drops matched sending locals during refresh", () => {
    const sending = {
      ...createOptimisticConversationMessage({
        handle: "+15555550123",
        text: "On my way",
      }),
      chat_id: 1,
    }
    const failedMessage = {
      ...createOptimisticConversationMessage({
        handle: "+15555550123",
        text: "Still trying",
      }),
      chat_id: 1,
    }
    const failedCurrent = updateConversationMessageDelivery(
      [failedMessage],
      failedMessage.clientId ?? failedMessage.guid,
      "failed",
      "Timed out"
    )[0]!

    const loaded = mergeLoadedMessages(
      [sending, failedCurrent],
      [
        makeMessage({
          created_at: sending.created_at,
          guid: "server-guid-1",
          id: 99,
          is_from_me: true,
          sender: "+15555550123",
          text: "On my way",
        }),
      ]
    )

    expect(loaded).toHaveLength(2)
    expect(loaded.some((message) => message.guid === "server-guid-1")).toBe(true)
    expect(loaded.some((message) => message.clientId === failedCurrent.clientId)).toBe(
      true
    )
  })

  it("keeps realtime server messages that are newer than a refresh snapshot", () => {
    const realtimeMessage = makeMessage({
      created_at: "2026-04-17T12:05:00.000Z",
      guid: "realtime-guid",
      id: 101,
      text: "Arrived over SSE",
    })

    const loaded = mergeLoadedMessages(
      [
        makeMessage({
          created_at: "2026-04-17T12:00:00.000Z",
          guid: "loaded-guid",
          id: 100,
          text: "Loaded snapshot",
        }),
        realtimeMessage,
      ],
      [
        makeMessage({
          created_at: "2026-04-17T12:00:00.000Z",
          guid: "loaded-guid",
          id: 100,
          text: "Loaded snapshot",
        }),
      ]
    )

    expect(loaded).toHaveLength(2)
    expect(loaded.some((message) => message.id === realtimeMessage.id)).toBe(true)
  })

  it("keeps chats sorted by activity while updating previews", () => {
    const next = applyChatActivity(
      [
        {
          id: 1,
          last_message_at: "2026-04-17T12:00:00.000Z",
          preview: "Earlier preview",
        },
        {
          id: 2,
          last_message_at: "2026-04-17T11:00:00.000Z",
          preview: "Older preview",
        },
      ],
      2,
      "2026-04-17T13:00:00.000Z",
      "Fresh preview"
    )

    expect(next[0]?.id).toBe(2)
    expect(next[0]?.preview).toBe("Fresh preview")
    expect(next[0]?.last_message_at).toBe("2026-04-17T13:00:00.000Z")
  })

  it("does not jump an older chat to the front when reloading it", () => {
    const next = applyChatActivity(
      [
        {
          id: 1,
          last_message_at: "2026-04-17T12:00:00.000Z",
          preview: "Newest preview",
        },
        {
          id: 2,
          last_message_at: "2026-04-17T11:00:00.000Z",
          preview: "Older preview",
        },
      ],
      2,
      "2026-04-17T11:00:00.000Z",
      "Still older"
    )

    expect(next[0]?.id).toBe(1)
    expect(next[1]?.id).toBe(2)
    expect(next[1]?.preview).toBe("Still older")
  })
})
