import Foundation
import Hummingbird
import HummingbirdWebSocket
import IMsgCore
import Logging

final class WebServer: Sendable {
  static let maxUploadBytes = 100 * 1024 * 1024

  let store: MessageStore
  let watcher: MessageWatcher
  let cache: ChatCache
  let contactResolver: ContactResolver
  let uploadStager: UploadStager
  let host: String
  let port: Int
  let sendMessage: @Sendable (MessageSendOptions) throws -> Void

  init(
    store: MessageStore,
    host: String,
    port: Int,
    sendMessage: @escaping @Sendable (MessageSendOptions) throws -> Void = {
      try MessageSender().send($0)
    }
  ) {
    self.store = store
    self.watcher = MessageWatcher(store: store)
    self.cache = ChatCache(store: store)
    self.contactResolver = ContactResolver()
    self.uploadStager = UploadStager()
    self.host = host
    self.port = port
    self.sendMessage = sendMessage
  }

  func run() async throws {
    // Teach the resolver how to construct avatar URLs that point back at this server so
    // that every ResolvedContact emitted over HTTP/WebSocket has a directly usable URL.
    await contactResolver.setAvatarURLBuilder { handle in
      return WebServer.avatarURLPath(for: handle)
    }
    await contactResolver.loadIfNeeded()

    let router = buildRouter()
    let wsRouter = buildWebSocketRouter()

    var logger = Logger(label: "imsg.serve")
    logger.logLevel = .info

    let app = Application(
      router: router,
      server: .http1WebSocketUpgrade(webSocketRouter: wsRouter),
      configuration: .init(address: .hostname(host, port: port)),
      logger: logger
    )

    StdoutWriter.writeLine("Listening on http://\(host):\(port)")
    try await app.runService()
  }

  /// Builds `/api/contacts/avatar?handle=<pct-encoded>` — a stable relative URL any web
  /// client can drop into an `<img src>` tag. Kept as a static method so it is available
  /// from the resolver's closure without touching server state.
  static func avatarURLPath(for handle: String) -> String {
    var components = URLComponents()
    components.path = "/api/contacts/avatar"
    components.queryItems = [URLQueryItem(name: "handle", value: handle)]
    return components.url?.relativeString ?? "/api/contacts/avatar"
  }

  /// Builds `/api/attachments/<ROWID>` — used by every enriched message payload so a web
  /// client can render images via `<img src={attachment_url}>` without ever touching the
  /// local filesystem.
  static func attachmentURLPath(id: Int64) -> String {
    return "/api/attachments/\(id)"
  }

  /// Builds `/api/attachments/<ROWID>/preview` — used for browser-safe derived previews
  /// of media like HEIC, sticker assets, and non-inline video formats.
  static func attachmentPreviewURLPath(id: Int64) -> String {
    return "/api/attachments/\(id)/preview"
  }

  static func shouldExposePreview(for meta: AttachmentMeta) -> Bool {
    AttachmentPreviewer.shouldExposePreview(for: meta)
  }

  static func messagesMediaDirectories(homeDirectory: String = NSHomeDirectory()) -> [String] {
    let home = (homeDirectory as NSString).standardizingPath
    return [
      (home as NSString).appendingPathComponent("Library/Messages/Attachments"),
      (home as NSString).appendingPathComponent("Library/Messages/StickerCache"),
    ].map { ($0 as NSString).standardizingPath }
  }

  static func isInsideMessagesMediaDirectory(
    path: String,
    homeDirectory: String = NSHomeDirectory()
  ) -> Bool {
    let expanded = (path as NSString).standardizingPath

    for base in messagesMediaDirectories(homeDirectory: homeDirectory) {
      if expanded == base || expanded.hasPrefix(base + "/") {
        return true
      }
    }

    return false
  }
}
