import Foundation
import Hummingbird
import HummingbirdWebSocket
import IMsgCore

extension WebServer {
  func buildWebSocketRouter() -> Router<BasicWebSocketRequestContext> {
    let wsRouter = Router(context: BasicWebSocketRequestContext.self)
    let localStore = store
    let localWatcher = watcher
    let localContactResolver = contactResolver

    wsRouter.ws("ws") { _, _ in
      .upgrade([:])
    } onUpgrade: { inbound, outbound, _ in
      let state = WSSubscriptionState()

      do {
        try await withThrowingTaskGroup(of: Void.self) { group in
          group.addTask {
            for try await message in localWatcher.stream() {
              let subscribedChat = await state.chatID
              if let subscribedChat, message.chatID != subscribedChat { continue }

              let inlineAvatars = await state.inlineAvatars
              let delivery: ContactResolver.AvatarDelivery =
                inlineAvatars ? .inline : .filePath
              let attachments = try localStore.attachments(for: message.rowID)
              let reactions = try localStore.reactions(for: message.rowID)
              let senderContact = message.sender.isEmpty
                ? nil
                : await localContactResolver.resolve(message.sender, delivery: delivery)
              let payload = MessagePayload(
                message: message,
                attachments: attachments,
                reactions: reactions,
                senderContact: senderContact,
                attachmentURLBuilder: { id in WebServer.attachmentURLPath(id: id) },
                attachmentPreviewURLBuilder: { id in
                  WebServer.attachmentPreviewURLPath(id: id)
                }
              )
              let event = WSMessageEvent(type: "message", message: payload)
              let data = try JSONEncoder().encode(event)
              if let json = String(data: data, encoding: .utf8) {
                try await outbound.write(.text(json))
              }
            }
          }

          group.addTask {
            for try await msg in inbound.messages(maxSize: 1 << 20) {
              if case .text(let text) = msg {
                guard let data = text.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                else { continue }

                let action = json["action"] as? String
                if action == "subscribe" {
                  if let chatID = (json["chat_id"] as? NSNumber)?.int64Value {
                    await state.subscribe(to: chatID)
                  }
                  if let inline = json["inline_avatar"] as? Bool {
                    await state.setInlineAvatars(inline)
                  }
                } else if action == "unsubscribe" {
                  await state.unsubscribe()
                }
              }
            }
          }

          try await group.next()
          group.cancelAll()
        }
      } catch {
        // Connection closed or watcher error — clean exit
      }
    }

    return wsRouter
  }
}

// MARK: - WebSocket types

private actor WSSubscriptionState {
  var chatID: Int64?
  var inlineAvatars: Bool = false

  func subscribe(to chatID: Int64) {
    self.chatID = chatID
  }

  func unsubscribe() {
    self.chatID = nil
  }

  func setInlineAvatars(_ value: Bool) {
    self.inlineAvatars = value
  }
}

private struct WSMessageEvent: Codable {
  let type: String
  let message: MessagePayload
}
