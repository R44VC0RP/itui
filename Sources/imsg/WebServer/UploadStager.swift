import Foundation

actor UploadStager {
  private static let maxFilenameLength = 180
  private static let maxMimeTypeLength = 255
  private static let metadataFilename = "metadata.json"
  private static let fallbackFilename = "attachment"
  private static let fallbackMimeType = "application/octet-stream"

  struct Upload: Sendable {
    let id: String
    let filename: String
    let mimeType: String
    let totalBytes: Int64
    let fileURL: URL
  }

  enum UploadError: Equatable, LocalizedError {
    case invalidIdentifier
    case missingUpload
    case missingFile

    var errorDescription: String? {
      switch self {
      case .invalidIdentifier:
        return "invalid upload id"
      case .missingUpload:
        return "upload not found"
      case .missingFile:
        return "upload file missing"
      }
    }
  }

  private struct Metadata: Codable {
    let filename: String
    let mimeType: String
    let totalBytes: Int64
  }

  private let fileManager: FileManager
  private let rootDirectory: URL

  init(
    fileManager: FileManager = .default,
    rootDirectory: URL = UploadStager.defaultRootDirectory()
  ) {
    self.fileManager = fileManager
    self.rootDirectory = rootDirectory
  }

  func stage(data: Data, filename: String, mimeType: String) throws -> Upload {
    try fileManager.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

    let id = UUID().uuidString.lowercased()
    let uploadDirectory = directory(for: id)
    try fileManager.createDirectory(at: uploadDirectory, withIntermediateDirectories: true)

    let sanitizedFilename = Self.sanitizeFilename(filename)
    let sanitizedMimeType = Self.sanitizeMimeType(mimeType)
    let fileURL = uploadDirectory.appendingPathComponent(sanitizedFilename, isDirectory: false)
    let metadataURL = uploadDirectory.appendingPathComponent(Self.metadataFilename, isDirectory: false)

    do {
      try data.write(to: fileURL, options: [.atomic])
      let metadata = Metadata(
        filename: sanitizedFilename,
        mimeType: sanitizedMimeType,
        totalBytes: Int64(data.count)
      )
      let encodedMetadata = try JSONEncoder().encode(metadata)
      try encodedMetadata.write(to: metadataURL, options: [.atomic])
    } catch {
      try? fileManager.removeItem(at: uploadDirectory)
      throw error
    }

    return Upload(
      id: id,
      filename: sanitizedFilename,
      mimeType: sanitizedMimeType,
      totalBytes: Int64(data.count),
      fileURL: fileURL
    )
  }

  func filePath(for id: String) throws -> String {
    return try upload(for: id).fileURL.path
  }

  func remove(id: String) {
    guard UUID(uuidString: id) != nil else {
      return
    }

    try? fileManager.removeItem(at: directory(for: id))
  }

  private func upload(for id: String) throws -> Upload {
    guard UUID(uuidString: id) != nil else {
      throw UploadError.invalidIdentifier
    }

    let uploadDirectory = directory(for: id)
    let metadataURL = uploadDirectory.appendingPathComponent(Self.metadataFilename, isDirectory: false)
    guard fileManager.fileExists(atPath: metadataURL.path) else {
      throw UploadError.missingUpload
    }

    let metadataData = try Data(contentsOf: metadataURL)
    let metadata = try JSONDecoder().decode(Metadata.self, from: metadataData)
    let fileURL = uploadDirectory.appendingPathComponent(metadata.filename, isDirectory: false)
    guard fileManager.fileExists(atPath: fileURL.path) else {
      throw UploadError.missingFile
    }

    return Upload(
      id: id,
      filename: metadata.filename,
      mimeType: metadata.mimeType,
      totalBytes: metadata.totalBytes,
      fileURL: fileURL
    )
  }

  private func directory(for id: String) -> URL {
    return rootDirectory.appendingPathComponent(id, isDirectory: true)
  }

  private static func defaultRootDirectory() -> URL {
    return FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Caches/imsg/uploads", isDirectory: true)
  }

  private static func sanitizeFilename(_ filename: String) -> String {
    let decoded = filename.removingPercentEncoding ?? filename
    let lastComponent = (decoded as NSString).lastPathComponent
    let trimmed = lastComponent.trimmingCharacters(in: .whitespacesAndNewlines)

    let scalarView = trimmed.unicodeScalars.filter {
      !CharacterSet.controlCharacters.contains($0) && $0 != "/" && $0 != "\\"
    }
    var cleaned = String(String.UnicodeScalarView(scalarView))

    if cleaned.isEmpty {
      cleaned = Self.fallbackFilename
    }

    if cleaned.caseInsensitiveCompare(Self.metadataFilename) == .orderedSame {
      cleaned = "\(Self.fallbackFilename)-upload"
    }

    return truncate(cleaned, maxLength: Self.maxFilenameLength)
  }

  private static func sanitizeMimeType(_ mimeType: String) -> String {
    let trimmed = mimeType
      .split(separator: ";", maxSplits: 1, omittingEmptySubsequences: true)
      .first?
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased() ?? Self.fallbackMimeType

    guard !trimmed.isEmpty else {
      return Self.fallbackMimeType
    }

    guard trimmed.utf8.count <= Self.maxMimeTypeLength else {
      return Self.fallbackMimeType
    }

    let pattern = #"^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+$"#
    guard trimmed.range(of: pattern, options: .regularExpression) != nil else {
      return Self.fallbackMimeType
    }

    return trimmed
  }

  private static func truncate(_ string: String, maxLength: Int) -> String {
    guard string.count > maxLength else {
      return string
    }

    return String(string.prefix(maxLength))
  }
}
