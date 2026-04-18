import Foundation
import HTTPTypes
import Hummingbird
import IMsgCore

extension WebServer {
  func buildRouter() -> Router<BasicRequestContext> {
    let router = Router()
    let localStore = store
    let localCache = cache
    let localSendMessage = sendMessage
    let localContactResolver = contactResolver
    let localUploadStager = uploadStager

    registerStaticRoutes(router: router)

    let api = router.group("api")

    api.get("chats") { request, _ -> Response in
      let limit = Self.queryInt(request: request, name: "limit") ?? 20
      let includeBase64 = Self.queryBool(request: request, name: "inline_avatar") ?? false
      let delivery: ContactResolver.AvatarDelivery = includeBase64 ? .inline : .filePath

      let chats = try localStore.listChats(limit: max(limit, 1))
      var payloads: [ChatListPayload] = []
      payloads.reserveCapacity(chats.count)

      for chat in chats {
        let info = try await localCache.info(chatID: chat.id)
        let participants = try await localCache.participants(chatID: chat.id)
        let identifier = info?.identifier ?? chat.identifier
        let guid = info?.guid ?? ""
        let name = (info?.name.isEmpty == false ? info?.name : nil) ?? chat.name
        let service = info?.service ?? chat.service

        // API responses always include resolved contacts for participants so that
        // clients can render group chat UIs without an additional round trip.
        let resolved = await localContactResolver.resolveMany(participants, delivery: delivery)
        let resolvedParticipants = participants.map { resolved[$0] ?? ResolvedContact.unresolved(handle: $0) }

        payloads.append(
          ChatListPayload(
            id: chat.id,
            name: name,
            identifier: identifier,
            guid: guid,
            service: service,
            lastMessageAt: CLIISO8601.format(chat.lastMessageAt),
            preview: chat.preview,
            participants: participants,
            isGroup: guid.contains(";+;") || identifier.contains(";+;"),
            participantsResolved: resolvedParticipants
          ))
      }

      return Self.jsonResponse(ChatsListResponse(chats: payloads))
    }

    api.get("chats/:id/messages") { request, context -> Response in
      guard let idStr = context.parameters.get("id"),
        let chatID = Int64(idStr)
      else {
        return Self.errorResponse(status: .badRequest, message: "invalid chat id")
      }
      let limit = Self.queryInt(request: request, name: "limit") ?? 50
      let includeAttachments = Self.queryBool(request: request, name: "attachments") ?? true
      let includeBase64 = Self.queryBool(request: request, name: "inline_avatar") ?? false
      let delivery: ContactResolver.AvatarDelivery = includeBase64 ? .inline : .filePath

      let messages = try localStore.messages(chatID: chatID, limit: max(limit, 1))
      var payloads: [MessagePayload] = []
      payloads.reserveCapacity(messages.count)

      let attachmentsMap: [Int64: [AttachmentMeta]]
      let reactionsMap: [Int64: [Reaction]]
      if includeAttachments {
        let messageIDs = messages.map(\.rowID)
        let messageKeys = messages.map { (rowID: $0.rowID, guid: $0.guid) }
        attachmentsMap = try localStore.batchAttachments(for: messageIDs)
        reactionsMap = try localStore.batchReactions(for: messageKeys)
      } else {
        attachmentsMap = [:]
        reactionsMap = [:]
      }

      // Batch-resolve every sender handle in one shot to keep the contact cache hot.
      var senderHandles: Set<String> = []
      for message in messages where !message.sender.isEmpty {
        senderHandles.insert(message.sender)
      }
      let resolved = await localContactResolver.resolveMany(
        Array(senderHandles),
        delivery: delivery
      )

      let attachmentURLBuilder: @Sendable (Int64) -> String? = { id in
        WebServer.attachmentURLPath(id: id)
      }
      let previewURLBuilder: @Sendable (Int64) -> String? = { id in
        WebServer.attachmentPreviewURLPath(id: id)
      }
      for message in messages.reversed() {
        let attachments = attachmentsMap[message.rowID] ?? []
        let reactions = reactionsMap[message.rowID] ?? []
        let contact = resolved[message.sender]
        payloads.append(
          MessagePayload(
            message: message,
            attachments: attachments,
            reactions: reactions,
            senderContact: contact,
            attachmentURLBuilder: attachmentURLBuilder,
            attachmentPreviewURLBuilder: previewURLBuilder
          ))
      }

      return Self.jsonResponse(MessagesListResponse(messages: payloads))
    }

    api.post("uploads") { request, _ -> Response in
      let filename = Self.queryString(request: request, name: "filename") ?? "attachment"
      let mimeType = request.headers[.contentType] ?? "application/octet-stream"

      let body: ByteBuffer
      do {
        body = try await request.body.collect(upTo: WebServer.maxUploadBytes)
      } catch {
        return Self.errorResponse(status: .contentTooLarge, message: "upload is too large")
      }

      let data = Data(buffer: body)
      if data.isEmpty {
        return Self.errorResponse(status: .badRequest, message: "upload body is empty")
      }

      do {
        let upload = try await localUploadStager.stage(
          data: data,
          filename: filename,
          mimeType: mimeType
        )
        return Self.jsonResponse(StagedUploadResponse(upload: StagedUploadPayload(upload: upload)))
      } catch {
        return Self.errorResponse(
          status: .internalServerError,
          message: String(describing: error)
        )
      }
    }

    api.post("send") { request, _ -> Response in
      let body = try await request.body.collect(upTo: 1_048_576)
      let data = Data(buffer: body)
      guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        return Self.errorResponse(status: .badRequest, message: "invalid JSON body")
      }

      let text = stringParam(json["text"]) ?? ""
      let file = stringParam(json["file"]) ?? ""
      let uploadID = stringParam(json["upload_id"]) ?? ""
      let serviceRaw = stringParam(json["service"]) ?? "auto"
      let region = stringParam(json["region"]) ?? "US"

      guard let service = MessageService(rawValue: serviceRaw) else {
        return Self.errorResponse(status: .badRequest, message: "invalid service")
      }

      let recipient = stringParam(json["to"]) ?? ""
      let chatID = int64Param(json["chat_id"])
      let chatIdentifier = stringParam(json["chat_identifier"]) ?? ""
      let chatGUID = stringParam(json["chat_guid"]) ?? ""

      let input = ChatTargetInput(
        recipient: recipient,
        chatID: chatID,
        chatIdentifier: chatIdentifier,
        chatGUID: chatGUID
      )

      if input.hasChatTarget && !input.recipient.isEmpty {
        return Self.errorResponse(
          status: .badRequest, message: "use to or chat_*; not both")
      }
      if !file.isEmpty && !uploadID.isEmpty {
        return Self.errorResponse(
          status: .badRequest, message: "use file or upload_id; not both")
      }
      if !input.hasChatTarget && input.recipient.isEmpty {
        return Self.errorResponse(
          status: .badRequest, message: "to is required for direct sends")
      }
      var attachmentPath = file
      if !uploadID.isEmpty {
        do {
          attachmentPath = try await localUploadStager.filePath(for: uploadID)
        } catch let error as UploadStager.UploadError {
          return Self.errorResponse(
            status: .notFound,
            message: error.localizedDescription
          )
        } catch {
          return Self.errorResponse(
            status: .internalServerError,
            message: String(describing: error)
          )
        }
      }
      if text.isEmpty && attachmentPath.isEmpty {
        return Self.errorResponse(
          status: .badRequest, message: "text or attachment is required")
      }

      let resolvedTarget = try await ChatTargetResolver.resolveChatTarget(
        input: input,
        lookupChat: { chatID in try await localCache.info(chatID: chatID) },
        unknownChatError: { chatID in
          IMsgError.invalidChatTarget("unknown chat_id \(chatID)")
        }
      )

      defer {
        if !uploadID.isEmpty {
          Task {
            await localUploadStager.remove(id: uploadID)
          }
        }
      }

      do {
        try localSendMessage(
          MessageSendOptions(
            recipient: input.recipient,
            text: text,
            attachmentPath: attachmentPath,
            service: service,
            region: region,
            chatIdentifier: resolvedTarget.chatIdentifier,
            chatGUID: resolvedTarget.chatGUID
          )
        )
      } catch {
        return Self.errorResponse(
          status: .internalServerError,
          message: String(describing: error)
        )
      }

      return Self.jsonResponse(OkResponse(ok: true))
    }

    // MARK: Contacts endpoints

    // List all resolvable contacts. By default returns metadata + avatar URL/path. Pass
    // `?inline_avatar=1` to also include base64-encoded bytes for offline clients.
    api.get("contacts") { request, _ -> Response in
      let includeBase64 = Self.queryBool(request: request, name: "inline_avatar") ?? false
      let format = Self.queryString(request: request, name: "format") ?? "list"
      if format == "map" {
        // Legacy shape: { contacts: { handle: name } }
        let nameMap = await localContactResolver.nameMap()
        return Self.jsonResponse(ContactsNameMapResponse(contacts: nameMap))
      }
      let delivery: ContactResolver.AvatarDelivery = includeBase64 ? .inline : .filePath
      let contacts = await localContactResolver.allContacts(delivery: delivery)
      let authorization = await localContactResolver.authorizationStatus()
      return Self.jsonResponse(
        ContactsListResponse(
          authorization: authorization.rawValue,
          contacts: contacts
        )
      )
    }

    // Resolve a single handle. Always includes base64 unless explicitly disabled via
    // `?inline_avatar=0`, since this endpoint exists specifically to deliver one contact.
    api.get("contacts/resolve") { request, _ -> Response in
      guard let handle = Self.queryString(request: request, name: "handle"),
        !handle.isEmpty
      else {
        return Self.errorResponse(status: .badRequest, message: "handle is required")
      }
      let includeBase64 = Self.queryBool(request: request, name: "inline_avatar") ?? true
      let delivery: ContactResolver.AvatarDelivery = includeBase64 ? .inline : .filePath
      let contact = await localContactResolver.resolve(handle, delivery: delivery)
      return Self.jsonResponse(ContactResolveResponse(contact: contact))
    }

    // Stream the avatar PNG/JPEG for a handle. A 404 response is returned when the handle
    // has no avatar — clients can fall back to rendering `initials`.
    api.get("contacts/avatar") { request, _ -> Response in
      guard let handle = Self.queryString(request: request, name: "handle"),
        !handle.isEmpty
      else {
        return Self.errorResponse(status: .badRequest, message: "handle is required")
      }
      guard let payload = await localContactResolver.avatarData(for: handle) else {
        return Self.errorResponse(status: .notFound, message: "no avatar for handle")
      }
      var headers = HTTPFields()
      headers.append(HTTPField(name: .contentType, value: payload.mime))
      headers.append(HTTPField(name: .cacheControl, value: "private, max-age=3600"))
      return Response(
        status: .ok,
        headers: headers,
        body: .init(byteBuffer: ByteBuffer(bytes: payload.data))
      )
    }

    // MARK: Attachments

    // Stream a browser-safe derived preview for media the browser cannot render directly
    // from the stored bytes (for example HEIC/HEIF images, sticker assets, and QuickTime
    // movies). The handler still refuses anything outside the Messages media directories.
    api.get("attachments/:id/preview") { _, context -> Response in
      guard let idStr = context.parameters.get("id"),
        let rowID = Int64(idStr)
      else {
        return Self.errorResponse(status: .badRequest, message: "invalid attachment id")
      }
      guard let meta = try localStore.attachment(id: rowID) else {
        return Self.errorResponse(status: .notFound, message: "attachment not found")
      }
      if meta.missing || meta.originalPath.isEmpty {
        return Self.errorResponse(status: .notFound, message: "attachment file missing")
      }
      guard WebServer.isInsideMessagesMediaDirectory(path: meta.originalPath) else {
        return Self.errorResponse(
          status: .forbidden,
          message: "attachment path outside Messages directory"
        )
      }
      guard WebServer.shouldExposePreview(for: meta) else {
        return Self.errorResponse(
          status: .unsupportedMediaType,
          message: "attachment preview not available"
        )
      }

      do {
        let preview = try await AttachmentPreviewer.previewData(for: meta)
        let sourceURL = URL(fileURLWithPath: meta.originalPath)
        let baseName = Self.displayFilename(for: meta, sourceURL: sourceURL)
        let previewName = ((baseName as NSString).deletingPathExtension as NSString)
          .appendingPathExtension("png") ?? "attachment-preview.png"

        var headers = HTTPFields()
        headers.append(HTTPField(name: .contentType, value: preview.mimeType))
        headers.append(HTTPField(name: .cacheControl, value: "private, max-age=3600"))
        headers.append(
          HTTPField(
            name: .contentDisposition,
            value: "inline; filename=\"\(Self.sanitizeHeaderValue(previewName))\""
          ))

        return Response(
          status: .ok,
          headers: headers,
          body: .init(byteBuffer: ByteBuffer(bytes: preview.data))
        )
      } catch AttachmentPreviewError.generationFailed {
        return Self.errorResponse(
          status: .unsupportedMediaType,
          message: "attachment preview not available"
        )
      } catch {
        return Self.errorResponse(
          status: .internalServerError,
          message: String(describing: error)
        )
      }
    }

    // Stream the raw bytes of an attachment by its DB row id. The handler refuses to serve
    // anything not inside the Messages media directories even if the DB somehow points
    // elsewhere, so clients can never coerce the server into serving arbitrary files.
    api.get("attachments/:id") { _, context -> Response in
      guard let idStr = context.parameters.get("id"),
        let rowID = Int64(idStr)
      else {
        return Self.errorResponse(status: .badRequest, message: "invalid attachment id")
      }
      guard let meta = try localStore.attachment(id: rowID) else {
        return Self.errorResponse(status: .notFound, message: "attachment not found")
      }
      if meta.missing || meta.originalPath.isEmpty {
        return Self.errorResponse(status: .notFound, message: "attachment file missing")
      }
      guard WebServer.isInsideMessagesMediaDirectory(path: meta.originalPath) else {
        return Self.errorResponse(status: .forbidden, message: "attachment path outside Messages directory")
      }

      let url = URL(fileURLWithPath: meta.originalPath)
      guard let data = try? Data(contentsOf: url, options: .mappedIfSafe) else {
        return Self.errorResponse(status: .notFound, message: "attachment could not be read")
      }

      var headers = HTTPFields()
      let mime = meta.mimeType.isEmpty ? "application/octet-stream" : meta.mimeType
      headers.append(HTTPField(name: .contentType, value: mime))
      headers.append(HTTPField(name: .cacheControl, value: "private, max-age=3600"))
      // Offer a reasonable filename so "Save As" in a browser picks up the original name.
      let filename = Self.displayFilename(for: meta, sourceURL: url)
      headers.append(
        HTTPField(
          name: .contentDisposition,
          value: "inline; filename=\"\(Self.sanitizeHeaderValue(filename))\""))
      return Response(
        status: .ok,
        headers: headers,
        body: .init(byteBuffer: ByteBuffer(bytes: data))
      )
    }

    // MARK: Server-Sent Events

    // A long-lived SSE stream of new messages. Every message is emitted in the same shape
    // as `/api/chats/:id/messages` (with `sender_contact`, `attachment_url`, etc.) so a
    // browser can do `new EventSource('/api/events')` and feed the data straight into its
    // UI without extra round trips. Query params:
    //   - `chat_id`: limit to a specific chat (optional)
    //   - `since_rowid`: replay any messages newer than this rowid at connection time
    //   - `attachments=0`: skip attachment + reaction enrichment (cheaper)
    //   - `inline_avatar=1`: embed avatar base64 in every sender_contact
    api.get("events") { request, _ -> Response in
      let chatID = Self.queryInt64(request: request, name: "chat_id")
      let sinceRowID = Self.queryInt64(request: request, name: "since_rowid")
      let includeAttachments = Self.queryBool(request: request, name: "attachments") ?? true
      let includeReactions = Self.queryBool(request: request, name: "reactions") ?? true
      let includeBase64 = Self.queryBool(request: request, name: "inline_avatar") ?? false
      let delivery: ContactResolver.AvatarDelivery =
        includeBase64 ? .inline : .filePath

      let watcher = MessageWatcher(store: localStore)
      let config = MessageWatcherConfiguration(includeReactions: includeReactions)

      let body = ResponseBody { writer in
        // Initial comment + retry hint so browsers know how long to wait before reconnect.
        try await writer.write(
          ByteBuffer(string: ": connected\nretry: 3000\n\n")
        )
        do {
          for try await message in watcher.stream(
            chatID: chatID,
            sinceRowID: sinceRowID,
            configuration: config
          ) {
            let attachments: [AttachmentMeta]
            let reactions: [Reaction]
            if includeAttachments {
              attachments = (try? localStore.attachments(for: message.rowID)) ?? []
              reactions = (try? localStore.reactions(for: message.rowID)) ?? []
            } else {
              attachments = []
              reactions = []
            }
            let senderContact: ResolvedContact?
            if message.sender.isEmpty {
              senderContact = nil
            } else {
              senderContact = await localContactResolver.resolve(
                message.sender, delivery: delivery)
            }
            let payload = MessagePayload(
              message: message,
              attachments: attachments,
              reactions: reactions,
              senderContact: senderContact,
              attachmentURLBuilder: { id in WebServer.attachmentURLPath(id: id) },
              attachmentPreviewURLBuilder: { id in WebServer.attachmentPreviewURLPath(id: id) }
            )
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.withoutEscapingSlashes]
            let data = try encoder.encode(payload)
            let json = String(data: data, encoding: .utf8) ?? "{}"
            // SSE event block: `event: <name>\ndata: <json>\n\n`.
            let chunk = "event: message\ndata: \(json)\n\n"
            try await writer.write(ByteBuffer(string: chunk))
          }
        } catch {
          let err = "event: error\ndata: {\"message\":\"\(Self.escapeJSONString(String(describing: error)))\"}\n\n"
          try? await writer.write(ByteBuffer(string: err))
        }
        try await writer.finish(nil)
      }

      var headers = HTTPFields()
      headers.append(HTTPField(name: .contentType, value: "text/event-stream; charset=utf-8"))
      headers.append(HTTPField(name: .cacheControl, value: "no-cache, no-transform"))
      headers.append(HTTPField(name: .init("X-Accel-Buffering")!, value: "no"))
      // The connection header is intentionally set so intermediaries know not to pool.
      headers.append(HTTPField(name: .connection, value: "keep-alive"))
      return Response(status: .ok, headers: headers, body: body)
    }

    return router
  }

  private static func displayFilename(for meta: AttachmentMeta, sourceURL: URL) -> String {
    let transferName = meta.transferName.trimmingCharacters(in: .whitespacesAndNewlines)
    return transferName.isEmpty ? sourceURL.lastPathComponent : transferName
  }

  private static func sanitizeHeaderValue(_ value: String) -> String {
    // Strip characters that would break a Content-Disposition header. Good enough for the
    // handful of odd filenames Messages stores for stickers/HEICs.
    return value.replacingOccurrences(of: "\"", with: "")
      .replacingOccurrences(of: "\r", with: " ")
      .replacingOccurrences(of: "\n", with: " ")
  }

  private static func escapeJSONString(_ value: String) -> String {
    return value.replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "\"", with: "\\\"")
      .replacingOccurrences(of: "\n", with: " ")
      .replacingOccurrences(of: "\r", with: " ")
  }

  // MARK: - Helpers

  static func queryString(request: Request, name: String) -> String? {
    guard let components = URLComponents(string: request.uri.description) else { return nil }
    return components.queryItems?.first { $0.name == name }?.value
  }

  static func queryInt(request: Request, name: String) -> Int? {
    guard let components = URLComponents(string: request.uri.description) else { return nil }
    return components.queryItems?.first { $0.name == name }.flatMap { Int($0.value ?? "") }
  }

  static func queryInt64(request: Request, name: String) -> Int64? {
    guard let components = URLComponents(string: request.uri.description) else { return nil }
    return components.queryItems?.first { $0.name == name }.flatMap { Int64($0.value ?? "") }
  }

  static func queryBool(request: Request, name: String) -> Bool? {
    guard let components = URLComponents(string: request.uri.description) else { return nil }
    guard let value = components.queryItems?.first(where: { $0.name == name })?.value
    else { return nil }
    return value == "true" || value == "1"
  }

  static func jsonResponse<T: Encodable>(_ value: T) -> Response {
    do {
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.withoutEscapingSlashes]
      let data = try encoder.encode(value)
      let json = String(data: data, encoding: .utf8) ?? "{}"
      return Response(
        status: .ok,
        headers: HTTPFields([HTTPField(name: .contentType, value: "application/json")]),
        body: .init(byteBuffer: ByteBuffer(string: json))
      )
    } catch {
      return errorResponse(status: .internalServerError, message: "encoding error")
    }
  }

  static func errorResponse(status: HTTPResponse.Status, message: String) -> Response {
    let json: String
    if let data = try? JSONEncoder().encode(["error": message]),
      let str = String(data: data, encoding: .utf8)
    {
      json = str
    } else {
      json = "{\"error\":\"internal error\"}"
    }
    return Response(
      status: status,
      headers: HTTPFields([HTTPField(name: .contentType, value: "application/json")]),
      body: .init(byteBuffer: ByteBuffer(string: json))
    )
  }
}

// MARK: - Response types

struct ChatsListResponse: Codable {
  let chats: [ChatListPayload]
}

struct MessagesListResponse: Codable {
  let messages: [MessagePayload]
}

struct OkResponse: Codable {
  let ok: Bool
}

struct StagedUploadResponse: Codable {
  let upload: StagedUploadPayload
}

struct StagedUploadPayload: Codable {
  let id: String
  let filename: String
  let mimeType: String
  let totalBytes: Int64

  init(upload: UploadStager.Upload) {
    self.id = upload.id
    self.filename = upload.filename
    self.mimeType = upload.mimeType
    self.totalBytes = upload.totalBytes
  }

  enum CodingKeys: String, CodingKey {
    case id
    case filename
    case mimeType = "mime_type"
    case totalBytes = "total_bytes"
  }
}

/// Legacy response shape kept for the existing web UI. Returned only when
/// `/api/contacts?format=map` is called.
struct ContactsNameMapResponse: Codable {
  let contacts: [String: String]
}

/// New default response shape for `/api/contacts`. Includes the authorization status so
/// clients can surface an actionable error if Contacts access has not been granted yet.
struct ContactsListResponse: Codable {
  let authorization: String
  let contacts: [ResolvedContact]
}

struct ContactResolveResponse: Codable {
  let contact: ResolvedContact
}
