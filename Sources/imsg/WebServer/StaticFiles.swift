import Foundation
import HTTPTypes
import Hummingbird

extension WebServer {
  func registerStaticRoutes(router: Router<BasicRequestContext>) {
    router.get("/") { request, _ -> Response in
      Self.serveResource(path: "index.html", requestHeaders: request.headers)
    }
    router.get("index.html") { request, _ -> Response in
      Self.serveResource(path: "index.html", requestHeaders: request.headers)
    }
    router.get("assets/:file") { request, context -> Response in
      guard let file = context.parameters.get("file"), !file.isEmpty else {
        return Self.notFoundResponse()
      }

      return Self.serveResource(
        path: "assets/\(file)",
        requestHeaders: request.headers
      )
    }

    // Standalone verification page that exercises the contact/avatar API surface.
    // Serves at both `/debug` and `/debug.html` so it's easy to remember.
    router.get("debug") { request, _ -> Response in
      Self.serveResource(path: "debug.html", requestHeaders: request.headers)
    }
    router.get("debug.html") { request, _ -> Response in
      Self.serveResource(path: "debug.html", requestHeaders: request.headers)
    }
  }

  private static func serveResource(
    path: String,
    requestHeaders: HTTPFields
  ) -> Response {
    guard let url = resourceURL(path: path),
      let data = try? Data(contentsOf: url, options: .mappedIfSafe)
    else {
      return notFoundResponse()
    }

    let etag = "\"\(Self.djb2Hash(data))\""

    if let ifNoneMatch = requestHeaders[.ifNoneMatch], ifNoneMatch == etag {
      return Response(
        status: .notModified,
        headers: HTTPFields([
          HTTPField(name: .eTag, value: etag),
          HTTPField(name: .cacheControl, value: cacheControl(for: path)),
        ])
      )
    }

    var headers = HTTPFields()
    headers.append(HTTPField(name: .contentType, value: contentType(for: path)))
    headers.append(HTTPField(name: .cacheControl, value: cacheControl(for: path)))
    headers.append(HTTPField(name: .eTag, value: etag))

    return Response(
      status: .ok,
      headers: headers,
      body: .init(byteBuffer: ByteBuffer(bytes: data))
    )
  }

  private static func resourceURL(path: String) -> URL? {
    guard !path.isEmpty, !path.hasPrefix("/"), !path.contains(".."),
      let root = Bundle.module.resourceURL?.appendingPathComponent("web", isDirectory: true)
    else {
      return nil
    }

    let rootURL = root.standardizedFileURL.resolvingSymlinksInPath()
    let fileURL = rootURL.appendingPathComponent(path).standardizedFileURL.resolvingSymlinksInPath()

    guard fileURL.path.hasPrefix(rootURL.path + "/") || fileURL.path == rootURL.path else {
      return nil
    }

    return fileURL
  }

  private static func contentType(for path: String) -> String {
    let ext = URL(fileURLWithPath: path).pathExtension.lowercased()

    switch ext {
    case "css":
      return "text/css; charset=utf-8"
    case "gif":
      return "image/gif"
    case "html":
      return "text/html; charset=utf-8"
    case "ico":
      return "image/x-icon"
    case "jpeg", "jpg":
      return "image/jpeg"
    case "js", "mjs":
      return "application/javascript; charset=utf-8"
    case "json":
      return "application/json; charset=utf-8"
    case "png":
      return "image/png"
    case "svg":
      return "image/svg+xml"
    case "txt":
      return "text/plain; charset=utf-8"
    case "webp":
      return "image/webp"
    case "woff":
      return "font/woff"
    case "woff2":
      return "font/woff2"
    default:
      return "application/octet-stream"
    }
  }

  private static func cacheControl(for path: String) -> String {
    if path.hasPrefix("assets/") {
      return "public, max-age=31536000, immutable"
    }

    return "public, max-age=0, must-revalidate"
  }

  private static func notFoundResponse() -> Response {
    Response(status: .notFound, body: .init(byteBuffer: ByteBuffer(string: "Not Found")))
  }

  /// Simple DJB2 hash for ETag generation — fast and sufficient for cache validation.
  private static func djb2Hash(_ data: Data) -> String {
    var hash: UInt64 = 5381
    for byte in data {
      hash = ((hash &<< 5) &+ hash) &+ UInt64(byte)
    }
    return String(hash, radix: 16)
  }
}
