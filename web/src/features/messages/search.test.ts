import { describe, expect, it } from "vitest"

import { dedupeComposeOptionsByHandle } from "@/features/messages/compose-options"
import type { ChatRow } from "@/lib/imsg"
import { rankComposeOptions, rankThreads, conversationSecondaryText } from "@/features/messages/search"
import { buildThreadSummary } from "@/features/messages/thread-identity"
import type { ComposeOption } from "@/features/messages/types"

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
      initials: "RB",
      name: "Ryan Blalock",
    },
  ],
  preview: "See you soon",
  service: "iMessage",
  ...overrides,
})

describe("search ranking", () => {
  it("prefers direct handle and title matches over preview-only matches", () => {
    const exactThread = buildThreadSummary(makeChat(), 0)
    const previewOnlyThread = buildThreadSummary(
      makeChat({
        id: 2,
        identifier: "+15555550124",
        participants: ["+15555550124"],
        participants_resolved: [
          {
            avatar_base64: undefined,
            avatar_bytes: 0,
            avatar_mime: undefined,
            avatar_path: undefined,
            avatar_url: undefined,
            handle: "+15555550124",
            has_avatar: false,
            initials: "MM",
            name: "Mac mini",
          },
        ],
        preview: "Ryan asked about the browser pass",
      }),
      0
    )

    const ranked = rankThreads([previewOnlyThread, exactThread], "ryan")

    expect(ranked[0]?.id).toBe(exactThread.id)
  })

  it("shows subtitle context when the search matches participant identity", () => {
    const thread = buildThreadSummary(makeChat(), 0)

    expect(conversationSecondaryText(thread, "+1 (555) 555-0123")).toBe(
      "+15555550123"
    )
  })

  it("ranks exact compose-handle matches ahead of weaker title matches", () => {
    const options: ComposeOption[] = [
      {
        avatarContacts: [],
        avatarOverflowCount: 0,
        handle: "+15555550123",
        isExistingThread: true,
        isManual: false,
        key: "exact",
        participantContacts: [],
        service: "sms",
        subtitle: "+15555550123",
        threadId: 1,
        title: "Ryan Blalock",
      },
      {
        avatarContacts: [],
        avatarOverflowCount: 0,
        handle: "+15555550124",
        isExistingThread: false,
        isManual: false,
        key: "weaker",
        participantContacts: [],
        service: "auto",
        subtitle: "Start a new conversation",
        title: "Ryan from Ops",
      },
    ]

    const ranked = rankComposeOptions(options, "+15555550123")

    expect(ranked[0]?.key).toBe("exact")
  })

  it("dedupes duplicate compose handles after ranking so the visible top result stays correct", () => {
    const options: ComposeOption[] = [
      {
        avatarContacts: [],
        avatarOverflowCount: 0,
        handle: "+15555550123",
        isExistingThread: false,
        isManual: false,
        key: "weaker-duplicate",
        participantContacts: [],
        service: "auto",
        subtitle: "+15555550123",
        title: "Fallback label",
      },
      {
        avatarContacts: [],
        avatarOverflowCount: 0,
        handle: "+15555550123",
        isExistingThread: true,
        isManual: false,
        key: "best-duplicate",
        participantContacts: [],
        service: "sms",
        subtitle: "+15555550123",
        threadId: 1,
        title: "Russ Blalock",
      },
      {
        avatarContacts: [],
        avatarOverflowCount: 0,
        handle: "+15555550124",
        isExistingThread: false,
        isManual: false,
        key: "other",
        participantContacts: [],
        service: "auto",
        subtitle: "+15555550124",
        title: "Scott Pauley",
      },
    ]

    const ranked = rankComposeOptions(options, "russ")
    const deduped = dedupeComposeOptionsByHandle(ranked)

    expect(deduped).toHaveLength(1)
    expect(deduped[0]?.key).toBe("best-duplicate")
  })
})
