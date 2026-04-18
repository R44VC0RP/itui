import CoreGraphics
import Foundation
import ImageIO
import QuickLookThumbnailing
import UniformTypeIdentifiers

import IMsgCore

enum AttachmentPreviewError: Error {
  case generationFailed
}

enum AttachmentPreviewer {
  private static let browserUnsupportedImageMIMETypes: Set<String> = [
    "image/heic",
    "image/heics",
    "image/heif",
    "image/heifs",
    "image/heic-sequence",
    "image/heif-sequence",
  ]

  private static let browserUnsupportedImageUTIs: Set<String> = [
    "public.heic",
    "public.heics",
    "public.heif",
    "public.heifs",
  ]

  private static let browserUnsupportedImageExtensions: Set<String> = [
    "heic",
    "heics",
    "heif",
    "heifs",
  ]

  private static let browserInlineVideoMIMETypes: Set<String> = [
    "video/mp4",
    "video/ogg",
    "video/webm",
    "video/x-m4v",
  ]

  private static let browserInlineVideoExtensions: Set<String> = [
    "m4v",
    "mp4",
    "ogg",
    "webm",
  ]

  private static let previewDimension: CGFloat = 1600
  private static let previewScale: CGFloat = 2

  static func shouldExposePreview(for meta: AttachmentMeta) -> Bool {
    guard meta.missing == false, meta.originalPath.isEmpty == false else {
      return false
    }

    if needsBrowserImagePreview(meta: meta) {
      return true
    }

    if isVideoAttachment(meta: meta) && supportsInlineVideo(meta: meta) == false {
      return true
    }

    return false
  }

  static func previewData(for meta: AttachmentMeta) async throws -> (data: Data, mimeType: String) {
    let fileURL = URL(fileURLWithPath: meta.originalPath)
    let image = try await generateThumbnail(for: fileURL)
    let data = try encodePNG(image)
    return (data, UTType.png.preferredMIMEType ?? "image/png")
  }

  private static func needsBrowserImagePreview(meta: AttachmentMeta) -> Bool {
    guard isImageAttachment(meta: meta) else {
      return false
    }

    let mime = normalized(meta.mimeType)
    let uti = normalized(meta.uti)
    let ext = attachmentExtension(meta: meta)

    return browserUnsupportedImageMIMETypes.contains(mime)
      || browserUnsupportedImageUTIs.contains(uti)
      || browserUnsupportedImageExtensions.contains(ext)
  }

  private static func supportsInlineVideo(meta: AttachmentMeta) -> Bool {
    let mime = normalized(meta.mimeType)
    let ext = attachmentExtension(meta: meta)
    return browserInlineVideoMIMETypes.contains(mime)
      || browserInlineVideoExtensions.contains(ext)
  }

  private static func isImageAttachment(meta: AttachmentMeta) -> Bool {
    let mime = normalized(meta.mimeType)
    let uti = normalized(meta.uti)
    let ext = attachmentExtension(meta: meta)

    if mime.hasPrefix("image/") {
      return true
    }
    if uti.contains("image") || browserUnsupportedImageUTIs.contains(uti) {
      return true
    }
    return browserUnsupportedImageExtensions.contains(ext)
  }

  private static func isVideoAttachment(meta: AttachmentMeta) -> Bool {
    let mime = normalized(meta.mimeType)
    let uti = normalized(meta.uti)
    let ext = attachmentExtension(meta: meta)

    if mime.hasPrefix("video/") {
      return true
    }
    if uti.contains("movie") || uti.contains("video") {
      return true
    }
    return ["mov", "mp4", "m4v", "ogg", "webm"].contains(ext)
  }

  private static func attachmentExtension(meta: AttachmentMeta) -> String {
    let preferredPath = meta.filename.isEmpty ? meta.originalPath : meta.filename
    return URL(fileURLWithPath: preferredPath).pathExtension.lowercased()
  }

  private static func normalized(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  private static func generateThumbnail(for fileURL: URL) async throws -> CGImage {
    let request = QLThumbnailGenerator.Request(
      fileAt: fileURL,
      size: CGSize(width: previewDimension, height: previewDimension),
      scale: previewScale,
      representationTypes: .thumbnail
    )

    return try await withCheckedThrowingContinuation { continuation in
      QLThumbnailGenerator.shared.generateBestRepresentation(for: request) {
        representation,
        error in
        if let error {
          continuation.resume(throwing: error)
          return
        }

        guard let image = representation?.cgImage else {
          continuation.resume(throwing: AttachmentPreviewError.generationFailed)
          return
        }

        continuation.resume(returning: image)
      }
    }
  }

  private static func encodePNG(_ image: CGImage) throws -> Data {
    let data = NSMutableData()
    guard
      let destination = CGImageDestinationCreateWithData(
        data,
        UTType.png.identifier as CFString,
        1,
        nil
      )
    else {
      throw AttachmentPreviewError.generationFailed
    }

    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
      throw AttachmentPreviewError.generationFailed
    }

    return data as Data
  }
}
