import Foundation
import SQLite

public final class MessageStore: @unchecked Sendable {
  public static let appleEpochOffset: TimeInterval = 978_307_200

  public static var defaultPath: String {
    let home = FileManager.default.homeDirectoryForCurrentUser.path
    return NSString(string: home).appendingPathComponent("Library/Messages/chat.db")
  }

  public let path: String

  private let connection: Connection
  private let queue: DispatchQueue
  private let queueKey = DispatchSpecificKey<Void>()
  let hasAttributedBody: Bool
  let hasReactionColumns: Bool
  let hasThreadOriginatorGUIDColumn: Bool
  let hasDestinationCallerID: Bool
  let hasAudioMessageColumn: Bool
  let hasAttachmentUserInfo: Bool
  let hasBalloonBundleIDColumn: Bool

  private struct URLBalloonDedupeEntry: Sendable {
    let rowID: Int64
    let date: Date
  }

  private static let urlBalloonDedupeWindow: TimeInterval = 90
  private static let urlBalloonDedupeRetention: TimeInterval = 10 * 60

  private var urlBalloonDedupe: [String: URLBalloonDedupeEntry] = [:]

  public init(path: String = MessageStore.defaultPath) throws {
    let normalized = NSString(string: path).expandingTildeInPath
    self.path = normalized
    self.queue = DispatchQueue(label: "imsg.db", qos: .userInitiated)
    self.queue.setSpecific(key: queueKey, value: ())
    do {
      let uri = URL(fileURLWithPath: normalized).absoluteString
      let location = Connection.Location.uri(uri, parameters: [.mode(.readOnly)])
      self.connection = try Connection(location, readonly: true)
      self.connection.busyTimeout = 5
      let messageColumns = MessageStore.tableColumns(connection: self.connection, table: "message")
      let attachmentColumns = MessageStore.tableColumns(
        connection: self.connection,
        table: "attachment"
      )
      self.hasAttributedBody = messageColumns.contains("attributedbody")
      self.hasReactionColumns = MessageStore.reactionColumnsPresent(in: messageColumns)
      self.hasThreadOriginatorGUIDColumn = messageColumns.contains("thread_originator_guid")
      self.hasDestinationCallerID = messageColumns.contains("destination_caller_id")
      self.hasAudioMessageColumn = messageColumns.contains("is_audio_message")
      self.hasAttachmentUserInfo = attachmentColumns.contains("user_info")
      self.hasBalloonBundleIDColumn = messageColumns.contains("balloon_bundle_id")
    } catch {
      throw MessageStore.enhance(error: error, path: normalized)
    }
  }

  init(
    connection: Connection,
    path: String,
    hasAttributedBody: Bool? = nil,
    hasReactionColumns: Bool? = nil,
    hasThreadOriginatorGUIDColumn: Bool? = nil,
    hasDestinationCallerID: Bool? = nil,
    hasAudioMessageColumn: Bool? = nil,
    hasAttachmentUserInfo: Bool? = nil,
    hasBalloonBundleIDColumn: Bool? = nil
  ) throws {
    self.path = path
    self.queue = DispatchQueue(label: "imsg.db.test", qos: .userInitiated)
    self.queue.setSpecific(key: queueKey, value: ())
    self.connection = connection
    self.connection.busyTimeout = 5
    let messageColumns = MessageStore.tableColumns(connection: connection, table: "message")
    let attachmentColumns = MessageStore.tableColumns(connection: connection, table: "attachment")
    if let hasAttributedBody {
      self.hasAttributedBody = hasAttributedBody
    } else {
      self.hasAttributedBody = messageColumns.contains("attributedbody")
    }
    if let hasReactionColumns {
      self.hasReactionColumns = hasReactionColumns
    } else {
      self.hasReactionColumns = MessageStore.reactionColumnsPresent(in: messageColumns)
    }
    if let hasThreadOriginatorGUIDColumn {
      self.hasThreadOriginatorGUIDColumn = hasThreadOriginatorGUIDColumn
    } else {
      self.hasThreadOriginatorGUIDColumn = messageColumns.contains("thread_originator_guid")
    }
    if let hasDestinationCallerID {
      self.hasDestinationCallerID = hasDestinationCallerID
    } else {
      self.hasDestinationCallerID = messageColumns.contains("destination_caller_id")
    }
    if let hasAudioMessageColumn {
      self.hasAudioMessageColumn = hasAudioMessageColumn
    } else {
      self.hasAudioMessageColumn = messageColumns.contains("is_audio_message")
    }
    if let hasAttachmentUserInfo {
      self.hasAttachmentUserInfo = hasAttachmentUserInfo
    } else {
      self.hasAttachmentUserInfo = attachmentColumns.contains("user_info")
    }
    if let hasBalloonBundleIDColumn {
      self.hasBalloonBundleIDColumn = hasBalloonBundleIDColumn
    } else {
      self.hasBalloonBundleIDColumn = messageColumns.contains("balloon_bundle_id")
    }
  }

  public func listChats(limit: Int) throws -> [Chat] {
    let bodyColumn = hasAttributedBody ? "m.attributedBody" : "NULL"
    let associatedTypeColumn = hasReactionColumns ? "m.associated_message_type" : "NULL"
    let audioMessageColumn = hasAudioMessageColumn ? "m.is_audio_message" : "0"
    let sql = """
      WITH ranked_messages AS (
        SELECT
          cmj.chat_id AS chat_id,
          m.ROWID AS message_id,
          IFNULL(m.text, '') AS text,
          m.is_from_me,
          m.date,
          \(associatedTypeColumn) AS associated_type,
          \(bodyColumn) AS body,
          \(audioMessageColumn) AS is_audio_message,
          (
            SELECT COUNT(*)
            FROM message_attachment_join maj
            WHERE maj.message_id = m.ROWID
          ) AS attachment_count,
          (
            SELECT IFNULL(a.transfer_name, '')
            FROM message_attachment_join maj
            JOIN attachment a ON a.ROWID = maj.attachment_id
            WHERE maj.message_id = m.ROWID
            ORDER BY a.ROWID ASC
            LIMIT 1
          ) AS attachment_transfer_name,
          (
            SELECT IFNULL(a.mime_type, '')
            FROM message_attachment_join maj
            JOIN attachment a ON a.ROWID = maj.attachment_id
            WHERE maj.message_id = m.ROWID
            ORDER BY a.ROWID ASC
            LIMIT 1
          ) AS attachment_mime_type,
          ROW_NUMBER() OVER (
            PARTITION BY cmj.chat_id
            ORDER BY m.date DESC, m.ROWID DESC
          ) AS message_rank
        FROM chat_message_join cmj
        JOIN message m ON m.ROWID = cmj.message_id
      )
      SELECT
        c.ROWID,
        IFNULL(c.display_name, c.chat_identifier) AS name,
        c.chat_identifier,
        c.service_name,
        ranked_messages.date AS last_date,
        ranked_messages.message_id,
        ranked_messages.text,
        ranked_messages.is_from_me,
        ranked_messages.associated_type,
        ranked_messages.attachment_count,
        ranked_messages.attachment_transfer_name,
        ranked_messages.attachment_mime_type,
        ranked_messages.body,
        ranked_messages.is_audio_message
      FROM chat c
      JOIN ranked_messages
        ON ranked_messages.chat_id = c.ROWID
        AND ranked_messages.message_rank = 1
      ORDER BY ranked_messages.date DESC, ranked_messages.message_id DESC
      LIMIT ?
      """
    return try withConnection { db in
      var chats: [Chat] = []
      for row in try db.prepare(sql, limit) {
        let id = int64Value(row[0]) ?? 0
        let name = stringValue(row[1])
        let identifier = stringValue(row[2])
        let service = stringValue(row[3])
        let lastDate = appleDate(from: int64Value(row[4]))
        let messageID = int64Value(row[5]) ?? 0
        let text = stringValue(row[6])
        let isFromMe = boolValue(row[7])
        let associatedType = intValue(row[8])
        let attachmentCount = intValue(row[9]) ?? 0
        let attachmentTransferName = stringValue(row[10])
        let attachmentMimeType = stringValue(row[11])
        let body = dataValue(row[12])
        let isAudioMessage = boolValue(row[13])
        var resolvedText = text.isEmpty ? TypedStreamParser.parseAttributedBody(body) : text
        if isAudioMessage,
          let transcription = try audioTranscription(for: messageID),
          !transcription.isEmpty
        {
          resolvedText = transcription
        }

        chats.append(
          Chat(
            id: id,
            identifier: identifier,
            name: name,
            service: service,
            lastMessageAt: lastDate,
            preview: MessageStore.chatPreviewSummary(
              text: resolvedText,
              isFromMe: isFromMe,
              associatedType: associatedType,
              attachmentCount: attachmentCount,
              attachmentTransferName: attachmentTransferName,
              attachmentMimeType: attachmentMimeType
            )
          )
        )
      }
      return chats
    }
  }

  public func chatInfo(chatID: Int64) throws -> ChatInfo? {
    let sql = """
      SELECT c.ROWID, IFNULL(c.chat_identifier, '') AS identifier, IFNULL(c.guid, '') AS guid,
             IFNULL(c.display_name, c.chat_identifier) AS name, IFNULL(c.service_name, '') AS service
      FROM chat c
      WHERE c.ROWID = ?
      LIMIT 1
      """
    return try withConnection { db in
      for row in try db.prepare(sql, chatID) {
        let id = int64Value(row[0]) ?? 0
        let identifier = stringValue(row[1])
        let guid = stringValue(row[2])
        let name = stringValue(row[3])
        let service = stringValue(row[4])
        return ChatInfo(
          id: id,
          identifier: identifier,
          guid: guid,
          name: name,
          service: service
        )
      }
      return nil
    }
  }

  public func participants(chatID: Int64) throws -> [String] {
    let sql = """
      SELECT h.id
      FROM chat_handle_join chj
      JOIN handle h ON h.ROWID = chj.handle_id
      WHERE chj.chat_id = ?
      ORDER BY h.id ASC
      """
    return try withConnection { db in
      var results: [String] = []
      var seen = Set<String>()
      for row in try db.prepare(sql, chatID) {
        let handle = stringValue(row[0])
        if handle.isEmpty { continue }
        if seen.insert(handle).inserted {
          results.append(handle)
        }
      }
      return results
    }
  }

  func withConnection<T>(_ block: (Connection) throws -> T) throws -> T {
    if DispatchQueue.getSpecific(key: queueKey) != nil {
      return try block(connection)
    }
    return try queue.sync {
      try block(connection)
    }
  }

  func shouldSkipURLBalloonDuplicate(
    chatID: Int64,
    sender: String,
    text: String,
    isFromMe: Bool,
    date: Date,
    rowID: Int64
  ) -> Bool {
    guard !text.isEmpty else { return false }

    pruneURLBalloonDedupe(referenceDate: date)

    let key = "\(chatID)|\(isFromMe ? 1 : 0)|\(sender)|\(text)"
    let current = URLBalloonDedupeEntry(rowID: rowID, date: date)
    guard let previous = urlBalloonDedupe[key] else {
      urlBalloonDedupe[key] = current
      return false
    }

    urlBalloonDedupe[key] = current
    if rowID <= previous.rowID {
      return true
    }
    return date.timeIntervalSince(previous.date) <= MessageStore.urlBalloonDedupeWindow
  }

  private func pruneURLBalloonDedupe(referenceDate: Date) {
    guard !urlBalloonDedupe.isEmpty else { return }
    let cutoff = referenceDate.addingTimeInterval(-MessageStore.urlBalloonDedupeRetention)
    urlBalloonDedupe = urlBalloonDedupe.filter { $0.value.date >= cutoff }
  }

  private static func chatPreviewSummary(
    text: String,
    isFromMe: Bool,
    associatedType: Int?,
    attachmentCount: Int,
    attachmentTransferName: String,
    attachmentMimeType: String
  ) -> String {
    let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)

    let summary: String
    if let associatedType, ReactionType.isReaction(associatedType) {
      summary = reactionPreviewSummary(text: text, associatedType: associatedType)
    } else if !trimmedText.isEmpty {
      summary = trimmedText
    } else if attachmentCount > 0 {
      summary = attachmentPreviewSummary(
        count: attachmentCount,
        transferName: attachmentTransferName,
        mimeType: attachmentMimeType
      )
    } else {
      summary = "Message"
    }

    return isFromMe ? "You: \(summary)" : summary
  }

  private static func reactionPreviewSummary(text: String, associatedType: Int) -> String {
    let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
    let customEmoji = trimmedText.isEmpty ? nil : trimmedText

    let reactionType: ReactionType?
    if ReactionType.isReactionRemove(associatedType) {
      reactionType = ReactionType.fromRemoval(associatedType, customEmoji: customEmoji)
    } else {
      reactionType = ReactionType(rawValue: associatedType, customEmoji: customEmoji)
    }

    let emoji = reactionType?.emoji ?? customEmoji ?? ""
    if ReactionType.isReactionRemove(associatedType) {
      return emoji.isEmpty ? "Removed a reaction" : "Removed \(emoji)"
    }

    return emoji.isEmpty ? "Reacted to a message" : "Reacted with \(emoji)"
  }

  private static func attachmentPreviewSummary(
    count: Int,
    transferName: String,
    mimeType: String
  ) -> String {
    if count > 1 {
      return "\(count) attachments"
    }

    let trimmedTransferName = transferName.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedTransferName.isEmpty {
      return trimmedTransferName
    }

    if mimeType.hasPrefix("image/") {
      return "Photo"
    }
    if mimeType.hasPrefix("video/") {
      return "Video"
    }
    if mimeType.hasPrefix("audio/") {
      return "Audio message"
    }

    return "Attachment"
  }
}

extension MessageStore {
  public func attachments(for messageID: Int64) throws -> [AttachmentMeta] {
    let sql = """
      SELECT a.ROWID, a.filename, a.transfer_name, a.uti, a.mime_type, a.total_bytes, a.is_sticker
      FROM message_attachment_join maj
      JOIN attachment a ON a.ROWID = maj.attachment_id
      WHERE maj.message_id = ?
      """
    return try withConnection { db in
      var metas: [AttachmentMeta] = []
      for row in try db.prepare(sql, messageID) {
        let rowID = int64Value(row[0]) ?? 0
        let filename = stringValue(row[1])
        let transferName = stringValue(row[2])
        let uti = stringValue(row[3])
        let mimeType = stringValue(row[4])
        let totalBytes = int64Value(row[5]) ?? 0
        let isSticker = boolValue(row[6])
        let resolved = AttachmentResolver.resolve(filename)
        metas.append(
          AttachmentMeta(
            rowID: rowID,
            filename: filename,
            transferName: transferName,
            uti: uti,
            mimeType: mimeType,
            totalBytes: totalBytes,
            isSticker: isSticker,
            originalPath: resolved.resolved,
            missing: resolved.missing
          ))
      }
      return metas
    }
  }

  /// Looks up a single attachment by its stable ROWID. Used by the HTTP attachment
  /// streaming endpoint so clients never pass filesystem paths.
  public func attachment(id rowID: Int64) throws -> AttachmentMeta? {
    let sql = """
      SELECT a.ROWID, a.filename, a.transfer_name, a.uti, a.mime_type, a.total_bytes, a.is_sticker
      FROM attachment a
      WHERE a.ROWID = ?
      LIMIT 1
      """
    return try withConnection { db in
      for row in try db.prepare(sql, rowID) {
        let id = int64Value(row[0]) ?? 0
        let filename = stringValue(row[1])
        let transferName = stringValue(row[2])
        let uti = stringValue(row[3])
        let mimeType = stringValue(row[4])
        let totalBytes = int64Value(row[5]) ?? 0
        let isSticker = boolValue(row[6])
        let resolved = AttachmentResolver.resolve(filename)
        return AttachmentMeta(
          rowID: id,
          filename: filename,
          transferName: transferName,
          uti: uti,
          mimeType: mimeType,
          totalBytes: totalBytes,
          isSticker: isSticker,
          originalPath: resolved.resolved,
          missing: resolved.missing
        )
      }
      return nil
    }
  }

  func audioTranscription(for messageID: Int64) throws -> String? {
    guard hasAttachmentUserInfo else { return nil }
    let sql = """
      SELECT a.user_info
      FROM message_attachment_join maj
      JOIN attachment a ON a.ROWID = maj.attachment_id
      WHERE maj.message_id = ?
      LIMIT 1
      """
    return try withConnection { db in
      for row in try db.prepare(sql, messageID) {
        let info = dataValue(row[0])
        guard !info.isEmpty else { continue }
        if let transcription = parseAudioTranscription(from: info) {
          return transcription
        }
      }
      return nil
    }
  }

  private func parseAudioTranscription(from data: Data) -> String? {
    do {
      let plist = try PropertyListSerialization.propertyList(
        from: data,
        options: [],
        format: nil
      )
      guard
        let dict = plist as? [String: Any],
        let transcription = dict["audio-transcription"] as? String,
        !transcription.isEmpty
      else {
        return nil
      }
      return transcription
    } catch {
      return nil
    }
  }

  public func maxRowID() throws -> Int64 {
    return try withConnection { db in
      let value = try db.scalar("SELECT MAX(ROWID) FROM message")
      return int64Value(value) ?? 0
    }
  }

  public func reactions(for messageID: Int64) throws -> [Reaction] {
    guard hasReactionColumns else { return [] }
    // Reactions are stored as messages with associated_message_type in range 2000-2006
    // 2000-2005 are standard tapbacks, 2006 is custom emoji reactions
    // They reference the original message via associated_message_guid which has format "p:X/GUID"
    // where X is the part index (0 for single-part messages) and GUID matches the original message's guid
    let bodyColumn = hasAttributedBody ? "r.attributedBody" : "NULL"
    let sql = """
      SELECT r.ROWID, r.associated_message_type, h.id, r.is_from_me, r.date, IFNULL(r.text, '') as text,
             \(bodyColumn) AS body
      FROM message m
      JOIN message r ON r.associated_message_guid = m.guid
        OR r.associated_message_guid LIKE '%/' || m.guid
      LEFT JOIN handle h ON r.handle_id = h.ROWID
      WHERE m.ROWID = ?
        AND m.guid IS NOT NULL
        AND m.guid != ''
        AND r.associated_message_type >= 2000
        AND r.associated_message_type <= 3006
      ORDER BY r.date ASC
      """
    return try withConnection { db in
      var reactions: [Reaction] = []
      var reactionIndex: [ReactionKey: Int] = [:]
      for row in try db.prepare(sql, messageID) {
        let rowID = int64Value(row[0]) ?? 0
        let typeValue = intValue(row[1]) ?? 0
        let sender = stringValue(row[2])
        let isFromMe = boolValue(row[3])
        let date = appleDate(from: int64Value(row[4]))
        let text = stringValue(row[5])
        let body = dataValue(row[6])
        let resolvedText = text.isEmpty ? TypedStreamParser.parseAttributedBody(body) : text

        if ReactionType.isReactionRemove(typeValue) {
          let customEmoji = typeValue == 3006 ? extractCustomEmoji(from: resolvedText) : nil
          let reactionType = ReactionType.fromRemoval(typeValue, customEmoji: customEmoji)
          if let reactionType {
            let key = ReactionKey(sender: sender, isFromMe: isFromMe, reactionType: reactionType)
            if let index = reactionIndex.removeValue(forKey: key) {
              reactions.remove(at: index)
              reactionIndex = ReactionKey.reindex(reactions: reactions)
            }
            continue
          }
          if typeValue == 3006 {
            if let index = reactions.firstIndex(where: {
              $0.sender == sender && $0.isFromMe == isFromMe && $0.reactionType.isCustom
            }) {
              reactions.remove(at: index)
              reactionIndex = ReactionKey.reindex(reactions: reactions)
            }
          }
          continue
        }

        let customEmoji: String? = typeValue == 2006 ? extractCustomEmoji(from: resolvedText) : nil
        guard let reactionType = ReactionType(rawValue: typeValue, customEmoji: customEmoji) else {
          continue
        }

        let key = ReactionKey(sender: sender, isFromMe: isFromMe, reactionType: reactionType)
        if let index = reactionIndex[key] {
          reactions[index] = Reaction(
            rowID: rowID,
            reactionType: reactionType,
            sender: sender,
            isFromMe: isFromMe,
            date: date,
            associatedMessageID: messageID
          )
        } else {
          reactionIndex[key] = reactions.count
          reactions.append(
            Reaction(
              rowID: rowID,
              reactionType: reactionType,
              sender: sender,
              isFromMe: isFromMe,
              date: date,
              associatedMessageID: messageID
            ))
        }
      }
      return reactions
    }
  }

  /// Extract custom emoji from reaction message text like "Reacted 🎉 to "original message""
  func extractCustomEmoji(from text: String) -> String? {
    // Format: "Reacted X to "..." where X is the emoji. Fallback to first emoji in text.
    guard
      let reactedRange = text.range(of: "Reacted "),
      let toRange = text.range(of: " to ", range: reactedRange.upperBound..<text.endIndex)
    else {
      return extractFirstEmoji(from: text)
    }
    let emoji = String(text[reactedRange.upperBound..<toRange.lowerBound])
    return emoji.isEmpty ? extractFirstEmoji(from: text) : emoji
  }

  private func extractFirstEmoji(from text: String) -> String? {
    for character in text {
      if character.unicodeScalars.contains(where: {
        $0.properties.isEmojiPresentation || $0.properties.isEmoji
      }) {
        return String(character)
      }
    }
    return nil
  }

  struct ReactionKey: Hashable {
    let sender: String
    let isFromMe: Bool
    let reactionType: ReactionType

    static func reindex(reactions: [Reaction]) -> [ReactionKey: Int] {
      var index: [ReactionKey: Int] = [:]
      for (offset, reaction) in reactions.enumerated() {
        let key = ReactionKey(
          sender: reaction.sender,
          isFromMe: reaction.isFromMe,
          reactionType: reaction.reactionType
        )
        index[key] = offset
      }
      return index
    }
  }

  // MARK: - Batch queries

  public func batchAttachments(for messageIDs: [Int64]) throws -> [Int64: [AttachmentMeta]] {
    guard !messageIDs.isEmpty else { return [:] }
    let placeholders = Array(repeating: "?", count: messageIDs.count).joined(separator: ",")
    let sql = """
      SELECT maj.message_id, a.ROWID, a.filename, a.transfer_name, a.uti, a.mime_type, a.total_bytes, a.is_sticker
      FROM message_attachment_join maj
      JOIN attachment a ON a.ROWID = maj.attachment_id
      WHERE maj.message_id IN (\(placeholders))
      """
    let bindings: [Binding?] = messageIDs.map { $0 as Binding? }
    return try withConnection { db in
      var result: [Int64: [AttachmentMeta]] = [:]
      for row in try db.prepare(sql, bindings) {
        let messageID = int64Value(row[0]) ?? 0
        let attachmentID = int64Value(row[1]) ?? 0
        let filename = stringValue(row[2])
        let transferName = stringValue(row[3])
        let uti = stringValue(row[4])
        let mimeType = stringValue(row[5])
        let totalBytes = int64Value(row[6]) ?? 0
        let isSticker = boolValue(row[7])
        let resolved = AttachmentResolver.resolve(filename)
        let meta = AttachmentMeta(
          rowID: attachmentID,
          filename: filename,
          transferName: transferName,
          uti: uti,
          mimeType: mimeType,
          totalBytes: totalBytes,
          isSticker: isSticker,
          originalPath: resolved.resolved,
          missing: resolved.missing
        )
        result[messageID, default: []].append(meta)
      }
      return result
    }
  }

  public func batchReactions(for messageKeys: [(rowID: Int64, guid: String)]) throws
    -> [Int64: [Reaction]]
  {
    guard hasReactionColumns else { return [:] }
    let validKeys = messageKeys.filter { !$0.guid.isEmpty }
    guard !validKeys.isEmpty else { return [:] }

    var guidToRowID: [String: Int64] = [:]
    for key in validKeys {
      guidToRowID[key.guid] = key.rowID
    }

    let guids = validKeys.map(\.guid)
    let placeholders = Array(repeating: "?", count: guids.count).joined(separator: ",")
    let bodyColumn = hasAttributedBody ? "r.attributedBody" : "NULL"
    let sql = """
      SELECT m.guid AS orig_guid,
             r.ROWID, r.associated_message_type, h.id, r.is_from_me, r.date,
             IFNULL(r.text, '') AS text, \(bodyColumn) AS body
      FROM message m
      JOIN message r ON r.associated_message_guid = m.guid
        OR r.associated_message_guid LIKE '%/' || m.guid
      LEFT JOIN handle h ON r.handle_id = h.ROWID
      WHERE m.guid IN (\(placeholders))
        AND m.guid IS NOT NULL AND m.guid != ''
        AND r.associated_message_type >= 2000 AND r.associated_message_type <= 3006
      ORDER BY r.date ASC
      """
    let bindings: [Binding?] = guids.map { $0 as Binding? }

    return try withConnection { db in
      // Per-message reaction state
      var reactionsMap: [Int64: [Reaction]] = [:]
      var reactionIndexMap: [Int64: [ReactionKey: Int]] = [:]

      for row in try db.prepare(sql, bindings) {
        let origGUID = stringValue(row[0])
        guard let messageRowID = guidToRowID[origGUID] else { continue }

        let rowID = int64Value(row[1]) ?? 0
        let typeValue = intValue(row[2]) ?? 0
        let sender = stringValue(row[3])
        let isFromMe = boolValue(row[4])
        let date = appleDate(from: int64Value(row[5]))
        let text = stringValue(row[6])
        let body = dataValue(row[7])
        let resolvedText = text.isEmpty ? TypedStreamParser.parseAttributedBody(body) : text

        var reactions = reactionsMap[messageRowID] ?? []
        var reactionIndex = reactionIndexMap[messageRowID] ?? [:]

        if ReactionType.isReactionRemove(typeValue) {
          let customEmoji = typeValue == 3006 ? extractCustomEmoji(from: resolvedText) : nil
          let reactionType = ReactionType.fromRemoval(typeValue, customEmoji: customEmoji)
          if let reactionType {
            let key = ReactionKey(sender: sender, isFromMe: isFromMe, reactionType: reactionType)
            if let index = reactionIndex.removeValue(forKey: key) {
              reactions.remove(at: index)
              reactionIndex = ReactionKey.reindex(reactions: reactions)
            }
          } else if typeValue == 3006 {
            if let index = reactions.firstIndex(where: {
              $0.sender == sender && $0.isFromMe == isFromMe && $0.reactionType.isCustom
            }) {
              reactions.remove(at: index)
              reactionIndex = ReactionKey.reindex(reactions: reactions)
            }
          }
          reactionsMap[messageRowID] = reactions
          reactionIndexMap[messageRowID] = reactionIndex
          continue
        }

        let customEmoji: String? = typeValue == 2006 ? extractCustomEmoji(from: resolvedText) : nil
        guard let reactionType = ReactionType(rawValue: typeValue, customEmoji: customEmoji) else {
          continue
        }

        let key = ReactionKey(sender: sender, isFromMe: isFromMe, reactionType: reactionType)
        let reaction = Reaction(
          rowID: rowID,
          reactionType: reactionType,
          sender: sender,
          isFromMe: isFromMe,
          date: date,
          associatedMessageID: messageRowID
        )

        if let index = reactionIndex[key] {
          reactions[index] = reaction
        } else {
          reactionIndex[key] = reactions.count
          reactions.append(reaction)
        }

        reactionsMap[messageRowID] = reactions
        reactionIndexMap[messageRowID] = reactionIndex
      }
      return reactionsMap
    }
  }
}
