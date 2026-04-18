import { describe, expect, it } from "vitest"

import type { ChatRow, Message } from "@/lib/imsg"
import { buildThreadSummary } from "@/features/messages/thread-identity"
import type { ThreadSummary } from "@/features/messages/types"
import {
  attachmentCanRenderInlineVideo,
  attachmentDisplayHref,
  attachmentTitle,
  draftServiceForHandle,
  findThreadByHandle,
  isURLBalloonMessage,
  sameBubbleGroup,
  threadService,
  threadServiceLabel,
} from "@/features/messages/utils"

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

describe("message utilities", () => {
  it("matches non-group threads by normalized handle", () => {
    const threads: ThreadSummary[] = [
      buildThreadSummary(makeChat(), 0),
      buildThreadSummary(
        makeChat({
          guid: "iMessage;+;group-1",
          id: 2,
          identifier: "iMessage;+;group-1",
          is_group: true,
          name: "Team",
          participants: ["+15555550123", "+15555550124"],
        }),
        0
      ),
    ]

    expect(findThreadByHandle(threads, "+1 (555) 555-0123")?.id).toBe(1)
    expect(findThreadByHandle(threads, "+15555550124")).toBeNull()
  })

  it("does not group adjacent incoming bubbles from different group senders", () => {
    const first = makeMessage({
      created_at: "2026-04-17T12:00:00.000Z",
      sender: "+15555550123",
    })
    const second = makeMessage({
      created_at: "2026-04-17T12:02:00.000Z",
      guid: "message-2",
      id: 2,
      sender: "+15555550124",
    })

    expect(sameBubbleGroup(second, first)).toBe(false)
  })

  it("treats phone handles as auto drafts and email handles as iMessage drafts", () => {
    expect(draftServiceForHandle("+1 (555) 555-0123")).toBe("auto")
    expect(draftServiceForHandle("hello@example.com")).toBe("imessage")
  })

  it("identifies rich-link balloon messages", () => {
    expect(
      isURLBalloonMessage(
        makeMessage({
          balloon_bundle_id: "com.apple.messages.URLBalloonProvider",
          text: "https://example.com/story",
        })
      )
    ).toBe(true)

    expect(
      isURLBalloonMessage(
        makeMessage({
          balloon_bundle_id: "com.apple.messages.URLBalloonProvider",
          text: "hello there",
        })
      )
    ).toBe(false)
  })

  it("maps RCS threads separately from SMS and iMessage", () => {
    expect(threadService("RCS")).toBe("rcs")
    expect(threadServiceLabel("rcs")).toBe("RCS")
  })

  it("prefers preview URLs for browser-rendered attachment media", () => {
    expect(
      attachmentDisplayHref({
        attachment_url: "/api/attachments/42",
        filename: "IMG_0001.HEIC",
        id: 42,
        is_sticker: false,
        mime_type: "image/heic",
        missing: false,
        original_path: "/tmp/IMG_0001.HEIC",
        preview_url: "/api/attachments/42/preview",
        total_bytes: 1024,
        transfer_name: "",
        uti: "public.heic",
      })
    ).toBe("/api/attachments/42/preview")
  })

  it("falls back to friendly attachment labels for sticker payloads and generated names", () => {
    expect(
      attachmentTitle({
        attachment_url: "/api/attachments/12",
        filename:
          "/Users/test/Library/Messages/StickerCache/73E11D6D-7B57-40A2-8D74-59C4271B3A0D.heic",
        id: 12,
        is_sticker: true,
        mime_type: "image/heic",
        missing: false,
        original_path:
          "/Users/test/Library/Messages/StickerCache/73E11D6D-7B57-40A2-8D74-59C4271B3A0D.heic",
        total_bytes: 5120,
        transfer_name: "",
        uti: "public.heic",
      })
    ).toBe("Sticker")
  })

  it("avoids rendering quicktime movies in the inline video player", () => {
    expect(
      attachmentCanRenderInlineVideo({
        attachment_url: "/api/attachments/55",
        filename: "clip.mov",
        id: 55,
        is_sticker: false,
        mime_type: "video/quicktime",
        missing: false,
        original_path: "/tmp/clip.mov",
        total_bytes: 128_000,
        transfer_name: "clip.mov",
        uti: "com.apple.quicktime-movie",
      })
    ).toBe(false)
  })
})
