import Foundation
import Testing

@testable import imsg

@Test
func uploadStagerStagesAndRemovesFiles() async throws {
  let fileManager = FileManager.default
  let root = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? fileManager.removeItem(at: root) }

  let stager = UploadStager(rootDirectory: root)
  let upload = try await stager.stage(
    data: Data("hello".utf8),
    filename: "../folder/photo.png",
    mimeType: "image/png"
  )

  #expect(upload.filename == "photo.png")
  #expect(fileManager.fileExists(atPath: upload.fileURL.path))
  #expect(try await stager.filePath(for: upload.id) == upload.fileURL.path)

  await stager.remove(id: upload.id)

  do {
    _ = try await stager.filePath(for: upload.id)
    #expect(Bool(false))
  } catch let error as UploadStager.UploadError {
    #expect(error == .missingUpload)
  }
}

@Test
func uploadStagerRejectsInvalidIdentifier() async throws {
  let fileManager = FileManager.default
  let root = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? fileManager.removeItem(at: root) }

  let stager = UploadStager(rootDirectory: root)

  do {
    _ = try await stager.filePath(for: "not-a-uuid")
    #expect(Bool(false))
  } catch let error as UploadStager.UploadError {
    #expect(error == .invalidIdentifier)
  }
}

@Test
func uploadStagerSanitizesReservedFilenameAndMimeType() async throws {
  let fileManager = FileManager.default
  let root = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? fileManager.removeItem(at: root) }

  let stager = UploadStager(rootDirectory: root)
  let upload = try await stager.stage(
    data: Data("hello".utf8),
    filename: "metadata.json",
    mimeType: "totally invalid type"
  )

  #expect(upload.filename == "attachment-upload")
  #expect(upload.mimeType == "application/octet-stream")
  #expect(upload.fileURL.lastPathComponent == "attachment-upload")
  #expect(fileManager.fileExists(atPath: upload.fileURL.path))
  #expect(
    fileManager.fileExists(
      atPath: root
        .appendingPathComponent(upload.id)
        .appendingPathComponent("metadata.json")
        .path
    )
  )
}
