import Foundation
import IMsgCore

func chatPayload(
  id: Int64,
  identifier: String,
  guid: String,
  name: String,
  service: String,
  lastMessageAt: Date,
  preview: String,
  participants: [String],
  participantsResolved: [ResolvedContact]? = nil
) -> [String: Any] {
  var payload: [String: Any] = [
    "id": id,
    "identifier": identifier,
    "guid": guid,
    "name": name,
    "service": service,
    "last_message_at": CLIISO8601.format(lastMessageAt),
    "preview": preview,
    "participants": participants,
    "is_group": isGroupHandle(identifier: identifier, guid: guid),
  ]
  if let resolved = participantsResolved {
    payload["participants_resolved"] = resolved.map { resolvedContactDictionary($0) }
  }
  return payload
}

func messagePayload(
  message: Message,
  chatInfo: ChatInfo?,
  participants: [String],
  attachments: [AttachmentMeta],
  reactions: [Reaction],
  senderContact: ResolvedContact? = nil
) throws -> [String: Any] {
  let identifier = chatInfo?.identifier ?? ""
  let guid = chatInfo?.guid ?? ""
  let name = chatInfo?.name ?? ""
  let core = MessagePayload(
    message: message,
    attachments: attachments,
    reactions: reactions,
    senderContact: senderContact
  )
  var payload = try core.asDictionary()
  payload["chat_identifier"] = identifier
  payload["chat_guid"] = guid
  payload["chat_name"] = name
  payload["participants"] = participants
  payload["is_group"] = isGroupHandle(identifier: identifier, guid: guid)
  return payload
}

func resolvedContactDictionary(_ contact: ResolvedContact) -> [String: Any] {
  var out: [String: Any] = [
    "handle": contact.handle,
    "initials": contact.initials,
    "has_avatar": contact.hasAvatar,
    "avatar_bytes": contact.avatarBytes,
  ]
  if let name = contact.name { out["name"] = name }
  if let mime = contact.avatarMime { out["avatar_mime"] = mime }
  if let path = contact.avatarPath { out["avatar_path"] = path }
  if let url = contact.avatarURL { out["avatar_url"] = url }
  if let b64 = contact.avatarBase64 { out["avatar_base64"] = b64 }
  return out
}

func attachmentPayload(_ meta: AttachmentMeta) -> [String: Any] {
  return [
    "id": meta.rowID,
    "filename": meta.filename,
    "transfer_name": meta.transferName,
    "uti": meta.uti,
    "mime_type": meta.mimeType,
    "total_bytes": meta.totalBytes,
    "is_sticker": meta.isSticker,
    "original_path": meta.originalPath,
    "missing": meta.missing,
  ]
}

func reactionPayload(_ reaction: Reaction) -> [String: Any] {
  return [
    "id": reaction.rowID,
    "type": reaction.reactionType.name,
    "emoji": reaction.reactionType.emoji,
    "sender": reaction.sender,
    "is_from_me": reaction.isFromMe,
    "created_at": CLIISO8601.format(reaction.date),
  ]
}

func isGroupHandle(identifier: String, guid: String) -> Bool {
  return guid.contains(";+;") || identifier.contains(";+;")
}

func stringParam(_ value: Any?) -> String? {
  if let value = value as? String { return value }
  if let number = value as? NSNumber { return number.stringValue }
  return nil
}

func intParam(_ value: Any?) -> Int? {
  if let value = value as? Int { return value }
  if let value = value as? NSNumber { return value.intValue }
  if let value = value as? String { return Int(value) }
  return nil
}

func int64Param(_ value: Any?) -> Int64? {
  if let value = value as? Int64 { return value }
  if let value = value as? Int { return Int64(value) }
  if let value = value as? NSNumber { return value.int64Value }
  if let value = value as? String { return Int64(value) }
  return nil
}

func boolParam(_ value: Any?) -> Bool? {
  if let value = value as? Bool { return value }
  if let value = value as? NSNumber { return value.boolValue }
  if let value = value as? String {
    if value == "true" { return true }
    if value == "false" { return false }
  }
  return nil
}

func stringArrayParam(_ value: Any?) -> [String] {
  if let list = value as? [String] { return list }
  if let list = value as? [Any] {
    return list.compactMap { stringParam($0) }
  }
  if let str = value as? String {
    return
      str
      .split(separator: ",")
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }
  return []
}
