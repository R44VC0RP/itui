import { describe, expect, it } from "vitest"

import type { ChatRow } from "@/lib/imsg"
import { buildThreadSummary } from "@/features/messages/thread-identity"

const makeChat = (overrides: Partial<ChatRow> = {}): ChatRow => ({
  guid: "iMessage;+;chat-1",
  id: 1,
  identifier: "+15555550123",
  is_group: false,
  last_message_at: "2026-04-17T12:00:00.000Z",
  name: "+15555550123",
  participants: ["+15555550123"],
  participants_resolved: [
    {
      avatar_base64: undefined,
      avatar_bytes: 0,
      avatar_mime: undefined,
      avatar_path: undefined,
      avatar_url: "/api/contacts/avatar?handle=%2B15555550123",
      handle: "+15555550123",
      has_avatar: true,
      initials: "AR",
      name: "Alex Rowan",
    },
  ],
  preview: "See you soon",
  service: "iMessage",
  ...overrides,
})

describe("thread identity", () => {
  it("builds 1:1 summaries from resolved contact data", () => {
    const summary = buildThreadSummary(makeChat(), 3)

    expect(summary.title).toBe("Alex Rowan")
    expect(summary.subtitle).toBe("+15555550123")
    expect(summary.contact?.handle).toBe("+15555550123")
    expect(summary.avatarContacts).toHaveLength(1)
    expect(summary.avatarOverflowCount).toBe(0)
    expect(summary.preview).toBe("See you soon")
    expect(summary.unreadCount).toBe(3)
  })

  it("builds group summaries with stacked avatars and participant metadata", () => {
    const summary = buildThreadSummary(
      makeChat({
        guid: "iMessage;+;group-1",
        id: 2,
        identifier: "iMessage;+;group-1",
        is_group: true,
        name: "",
        participants: ["+15555550123", "+15555550124", "+15555550125"],
        participants_resolved: [
          {
            avatar_base64: undefined,
            avatar_bytes: 0,
            avatar_mime: undefined,
            avatar_path: undefined,
            avatar_url: "/api/contacts/avatar?handle=%2B15555550123",
            handle: "+15555550123",
            has_avatar: true,
            initials: "AR",
            name: "Alex Rowan",
          },
          {
            avatar_base64: undefined,
            avatar_bytes: 0,
            avatar_mime: undefined,
            avatar_path: undefined,
            avatar_url: undefined,
            handle: "+15555550124",
            has_avatar: false,
            initials: "MP",
            name: "Morgan Park",
          },
          {
            avatar_base64: undefined,
            avatar_bytes: 0,
            avatar_mime: undefined,
            avatar_path: undefined,
            avatar_url: undefined,
            handle: "+15555550125",
            has_avatar: false,
            initials: "SK",
            name: "Sam Kim",
          },
        ],
      }),
      0
    )

    expect(summary.title).toBe("Alex Rowan, Morgan Park, Sam Kim")
    expect(summary.subtitle).toBe("3 participants")
    expect(summary.contact).toBeUndefined()
    expect(summary.avatarContacts).toHaveLength(2)
    expect(summary.avatarOverflowCount).toBe(1)
  })
})
