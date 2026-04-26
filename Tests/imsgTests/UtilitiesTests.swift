import Commander
import Foundation
import Testing

@testable import IMsgCore
@testable import imsg

@Test
func durationParserHandlesUnits() {
  #expect(DurationParser.parse("250ms") == 0.25)
  #expect(DurationParser.parse("2s") == 2)
  #expect(DurationParser.parse("3m") == 180)
  #expect(DurationParser.parse("1h") == 3600)
  #expect(DurationParser.parse("5") == 5)
  #expect(DurationParser.parse("bad") == nil)
}

@Test
func attachmentDisplayPrefersTransferName() {
  let meta = AttachmentMeta(
    rowID: 1,
    filename: "file.dat",
    transferName: "friendly.dat",
    uti: "",
    mimeType: "",
    totalBytes: 0,
    isSticker: false,
    originalPath: "",
    missing: false
  )
  #expect(displayName(for: meta) == "friendly.dat")
  let fallback = AttachmentMeta(
    rowID: 2,
    filename: "file.dat",
    transferName: "",
    uti: "",
    mimeType: "",
    totalBytes: 0,
    isSticker: false,
    originalPath: "",
    missing: false
  )
  #expect(displayName(for: fallback) == "file.dat")
  let unknown = AttachmentMeta(
    rowID: 3,
    filename: "",
    transferName: "",
    uti: "",
    mimeType: "",
    totalBytes: 0,
    isSticker: false,
    originalPath: "",
    missing: false
  )
  #expect(displayName(for: unknown) == "(unknown)")
  #expect(pluralSuffix(for: 1) == "")
  #expect(pluralSuffix(for: 2) == "s")
}

@Test
func jsonLinesPrintsSingleLineJSON() throws {
  let line = try JSONLines.encode(["status": "ok"])
  let data = line.data(using: .utf8)!
  let decoded = try JSONSerialization.jsonObject(with: data) as? [String: Any]
  #expect(decoded?["status"] as? String == "ok")
}

@Test
func outputModelsEncodeExpectedKeys() throws {
  let chat = Chat(
    id: 1, identifier: "+123", name: "Test", service: "iMessage",
    lastMessageAt: Date(timeIntervalSince1970: 0), preview: "hi")
  let chatPayload = ChatPayload(chat: chat)
  let chatData = try JSONEncoder().encode(chatPayload)
  let chatObject = try JSONSerialization.jsonObject(with: chatData) as? [String: Any]
  #expect(chatObject?["last_message_at"] != nil)

  let message = Message(
    rowID: 7,
    chatID: 1,
    sender: "+123",
    text: "hi",
    date: Date(timeIntervalSince1970: 1),
    isFromMe: false,
    service: "iMessage",
    handleID: nil,
    attachmentsCount: 0,
    guid: "msg-guid-7",
    replyToGUID: "msg-guid-1",
    threadOriginatorGUID: "thread-guid-7",
    destinationCallerID: "me@example.com"
  )
  let attachment = AttachmentMeta(
    rowID: 42,
    filename: "file.dat",
    transferName: "",
    uti: "public.data",
    mimeType: "application/octet-stream",
    totalBytes: 10,
    isSticker: false,
    originalPath: "/tmp/file.dat",
    missing: false
  )
  let reaction = Reaction(
    rowID: 99,
    reactionType: .like,
    sender: "+123",
    isFromMe: true,
    date: Date(timeIntervalSince1970: 2),
    associatedMessageID: 7
  )
  let messagePayload = MessagePayload(
    message: message, attachments: [attachment], reactions: [reaction])
  let messageData = try JSONEncoder().encode(messagePayload)
  let messageObject = try JSONSerialization.jsonObject(with: messageData) as? [String: Any]
  #expect(messageObject?["chat_id"] as? Int64 == 1)
  #expect(messageObject?["guid"] as? String == "msg-guid-7")
  #expect(messageObject?["reply_to_guid"] as? String == "msg-guid-1")
  #expect(messageObject?["destination_caller_id"] as? String == "me@example.com")
  #expect(messageObject?["thread_originator_guid"] as? String == "thread-guid-7")
  #expect(messageObject?["created_at"] != nil)

  let attachmentPayload = AttachmentPayload(meta: attachment)
  let attachmentData = try JSONEncoder().encode(attachmentPayload)
  let attachmentObject = try JSONSerialization.jsonObject(with: attachmentData) as? [String: Any]
  #expect(attachmentObject?["transfer_name"] as? String == "")
  #expect(attachmentObject?["mime_type"] as? String == "application/octet-stream")
}

@Test
func parsedValuesHelpers() throws {
  let values = ParsedValues(
    positional: ["first"],
    options: ["limit": ["5", "9"], "name": ["bob"], "logLevel": ["debug"]],
    flags: ["jsonOutput", "verbose"]
  )
  #expect(values.flag("jsonOutput") == true)
  #expect(values.option("name") == "bob")
  #expect(values.optionValues("limit").count == 2)
  #expect(values.optionInt("limit") == 9)
  #expect(values.optionInt64("limit") == 9)
  #expect(values.argument(0) == "first")
  do {
    _ = try values.optionRequired("missing")
    #expect(Bool(false))
  } catch let error as ParsedValuesError {
    #expect(error.description.contains("Missing required option"))
  }

  let runtime = RuntimeOptions(parsedValues: values)
  #expect(runtime.jsonOutput == true)
  #expect(runtime.verbose == true)
  #expect(runtime.logLevel == "debug")
}

@Test
func attachmentPreviewAndMediaDirectoryHelpersHandleStickerCacheAndPreviewRoutes() {
  #expect(WebServer.attachmentPreviewURLPath(id: 42) == "/api/attachments/42/preview")
  #expect(
    WebServer.isInsideMessagesMediaDirectory(
      path: "/Users/test/Library/Messages/Attachments/aa/bb/file.heic",
      homeDirectory: "/Users/test"
    ) == true
  )
  #expect(
    WebServer.isInsideMessagesMediaDirectory(
      path: "/Users/test/Library/Messages/StickerCache/sticker.heic",
      homeDirectory: "/Users/test"
    ) == true
  )
  #expect(
    WebServer.isInsideMessagesMediaDirectory(
      path: "/Users/test/Documents/not-allowed.png",
      homeDirectory: "/Users/test"
    ) == false
  )

  let heic = AttachmentMeta(
    rowID: 1,
    filename: "photo.heic",
    transferName: "",
    uti: "public.heic",
    mimeType: "image/heic",
    totalBytes: 10,
    isSticker: false,
    originalPath: "/Users/test/Library/Messages/Attachments/photo.heic",
    missing: false
  )
  #expect(WebServer.shouldExposePreview(for: heic) == true)

  let mov = AttachmentMeta(
    rowID: 2,
    filename: "clip.mov",
    transferName: "",
    uti: "com.apple.quicktime-movie",
    mimeType: "video/quicktime",
    totalBytes: 10,
    isSticker: false,
    originalPath: "/Users/test/Library/Messages/Attachments/clip.mov",
    missing: false
  )
  #expect(WebServer.shouldExposePreview(for: mov) == true)

  let mp4 = AttachmentMeta(
    rowID: 3,
    filename: "clip.mp4",
    transferName: "",
    uti: "public.mpeg-4",
    mimeType: "video/mp4",
    totalBytes: 10,
    isSticker: false,
    originalPath: "/Users/test/Library/Messages/Attachments/clip.mp4",
    missing: false
  )
  #expect(WebServer.shouldExposePreview(for: mp4) == false)
}
