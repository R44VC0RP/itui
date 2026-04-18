import Foundation
import IMsgCore

/// JSON representation of a chat row in the CLI. Enriched forms with resolved contacts
/// live in `ChatListPayload`, which is used by the HTTP server and can also be emitted by
/// the CLI when `--contacts` is set.
struct ChatPayload: Codable {
  let id: Int64
  let name: String
  let identifier: String
  let service: String
  let lastMessageAt: String

  init(chat: Chat) {
    self.id = chat.id
    self.name = chat.name
    self.identifier = chat.identifier
    self.service = chat.service
    self.lastMessageAt = CLIISO8601.format(chat.lastMessageAt)
  }

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case identifier
    case service
    case lastMessageAt = "last_message_at"
  }
}

struct MessagePayload: Codable {
  let id: Int64
  let chatID: Int64
  let guid: String
  let replyToGUID: String?
  let threadOriginatorGUID: String?
  let sender: String
  let isFromMe: Bool
  let text: String
  let createdAt: String
  let attachments: [AttachmentPayload]
  let reactions: [ReactionPayload]
  let balloonBundleID: String?
  /// The destination_caller_id from the database. For messages where is_from_me is true,
  /// this can help distinguish between messages actually sent by the local user vs
  /// messages received on a secondary phone number registered with the same Apple ID.
  let destinationCallerID: String?

  // Reaction event metadata (populated when this message is a reaction event)
  let isReaction: Bool?
  let reactionType: String?
  let reactionEmoji: String?
  let isReactionAdd: Bool?
  let reactedToGUID: String?

  /// Contact data for the sender, populated by the HTTP/WS/RPC layer (always on) or the
  /// CLI when `--contacts` is supplied. Nil for API clients when enrichment is opted out.
  let senderContact: ResolvedContact?

  init(
    message: Message,
    attachments: [AttachmentMeta],
    reactions: [Reaction] = [],
    senderContact: ResolvedContact? = nil,
    attachmentURLBuilder: ((Int64) -> String?)? = nil,
    attachmentPreviewURLBuilder: ((Int64) -> String?)? = nil
  ) {
    self.id = message.rowID
    self.chatID = message.chatID
    self.guid = message.guid
    self.replyToGUID = message.replyToGUID
    self.threadOriginatorGUID = message.threadOriginatorGUID
    self.sender = message.sender
    self.isFromMe = message.isFromMe
    self.text = message.text
    self.createdAt = CLIISO8601.format(message.date)
    self.attachments = attachments.map {
      AttachmentPayload(
        meta: $0,
        url: attachmentURLBuilder?($0.rowID),
        previewURL: WebServer.shouldExposePreview(for: $0)
          ? attachmentPreviewURLBuilder?($0.rowID)
          : nil
      )
    }
    self.reactions = reactions.map { ReactionPayload(reaction: $0) }
    self.balloonBundleID = message.balloonBundleID
    self.destinationCallerID = message.destinationCallerID
    self.senderContact = senderContact

    // Reaction event metadata
    if message.isReaction {
      self.isReaction = true
      self.reactionType = message.reactionType?.name
      self.reactionEmoji = message.reactionType?.emoji
      self.isReactionAdd = message.isReactionAdd
      self.reactedToGUID = message.reactedToGUID
    } else {
      self.isReaction = nil
      self.reactionType = nil
      self.reactionEmoji = nil
      self.isReactionAdd = nil
      self.reactedToGUID = nil
    }
  }

  enum CodingKeys: String, CodingKey {
    case id
    case chatID = "chat_id"
    case guid
    case replyToGUID = "reply_to_guid"
    case threadOriginatorGUID = "thread_originator_guid"
    case sender
    case isFromMe = "is_from_me"
    case text
    case createdAt = "created_at"
    case attachments
    case reactions
    case balloonBundleID = "balloon_bundle_id"
    case destinationCallerID = "destination_caller_id"
    case isReaction = "is_reaction"
    case reactionType = "reaction_type"
    case reactionEmoji = "reaction_emoji"
    case isReactionAdd = "is_reaction_add"
    case reactedToGUID = "reacted_to_guid"
    case senderContact = "sender_contact"
  }
}

extension MessagePayload {
  func asDictionary() throws -> [String: Any] {
    let data = try MessagePayload.encoder.encode(self)
    let json = try JSONSerialization.jsonObject(with: data)
    return (json as? [String: Any]) ?? [:]
  }

  private static let encoder: JSONEncoder = {
    JSONEncoder()
  }()
}

struct ReactionPayload: Codable {
  let id: Int64
  let type: String
  let emoji: String
  let sender: String
  let isFromMe: Bool
  let createdAt: String

  init(reaction: Reaction) {
    self.id = reaction.rowID
    self.type = reaction.reactionType.name
    self.emoji = reaction.reactionType.emoji
    self.sender = reaction.sender
    self.isFromMe = reaction.isFromMe
    self.createdAt = CLIISO8601.format(reaction.date)
  }

  enum CodingKeys: String, CodingKey {
    case id
    case type
    case emoji
    case sender
    case isFromMe = "is_from_me"
    case createdAt = "created_at"
  }
}

struct AttachmentPayload: Codable {
  let id: Int64
  let filename: String
  let transferName: String
  let uti: String
  let mimeType: String
  let totalBytes: Int64
  let isSticker: Bool
  let originalPath: String
  let missing: Bool
  /// HTTP URL pointing at the streaming endpoint (`/api/attachments/:id`). Populated only
  /// when the payload is produced by the embedded web server so other surfaces (CLI, RPC
  /// over stdio) leave it nil and clients fall back to `original_path`.
  let attachmentURL: String?
  /// Browser-safe derived preview URL for media the browser cannot render directly from
  /// the raw attachment bytes (for example HEIC/HEIF and QuickTime movies).
  let previewURL: String?

  init(meta: AttachmentMeta) {
    self.init(meta: meta, url: nil, previewURL: nil)
  }

  init(meta: AttachmentMeta, url: String?, previewURL: String?) {
    self.id = meta.rowID
    self.filename = meta.filename
    self.transferName = meta.transferName
    self.uti = meta.uti
    self.mimeType = meta.mimeType
    self.totalBytes = meta.totalBytes
    self.isSticker = meta.isSticker
    self.originalPath = meta.originalPath
    self.missing = meta.missing
    self.attachmentURL = url
    self.previewURL = previewURL
  }

  enum CodingKeys: String, CodingKey {
    case id
    case filename = "filename"
    case transferName = "transfer_name"
    case uti = "uti"
    case mimeType = "mime_type"
    case totalBytes = "total_bytes"
    case isSticker = "is_sticker"
    case originalPath = "original_path"
    case missing = "missing"
    case attachmentURL = "attachment_url"
    case previewURL = "preview_url"
  }
}

/// Chat row as delivered to HTTP/RPC clients. `participantsResolved` is only populated on
/// API surfaces (HTTP, WebSocket, RPC) that auto-enrich, or on the CLI `chats` command
/// when `--contacts` is set.
struct ChatListPayload: Codable {
  let id: Int64
  let name: String
  let identifier: String
  let guid: String
  let service: String
  let lastMessageAt: String
  let preview: String
  let participants: [String]
  let isGroup: Bool
  let participantsResolved: [ResolvedContact]?

  init(
    id: Int64,
    name: String,
    identifier: String,
    guid: String,
    service: String,
    lastMessageAt: String,
    preview: String,
    participants: [String],
    isGroup: Bool,
    participantsResolved: [ResolvedContact]? = nil
  ) {
    self.id = id
    self.name = name
    self.identifier = identifier
    self.guid = guid
    self.service = service
    self.lastMessageAt = lastMessageAt
    self.preview = preview
    self.participants = participants
    self.isGroup = isGroup
    self.participantsResolved = participantsResolved
  }

  enum CodingKeys: String, CodingKey {
    case id, name, identifier, guid, service, preview, participants
    case lastMessageAt = "last_message_at"
    case isGroup = "is_group"
    case participantsResolved = "participants_resolved"
  }
}

enum CLIISO8601 {
  static func format(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }
}
