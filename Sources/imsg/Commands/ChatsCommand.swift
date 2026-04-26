import Commander
import Foundation
import IMsgCore

enum ChatsCommand {
  static let spec = CommandSpec(
    name: "chats",
    abstract: "List recent conversations",
    discussion: nil,
    signature: CommandSignatures.withRuntimeFlags(
      CommandSignature(
        options: CommandSignatures.baseOptions() + [
          .make(label: "limit", names: [.long("limit")], help: "Number of chats to list")
        ],
        flags: CommandSignatures.contactFlags()
      )
    ),
    usageExamples: [
      "imsg chats --limit 5",
      "imsg chats --limit 5 --json",
      "imsg chats --limit 5 --contacts --json",
    ]
  ) { values, runtime in
    try await ChatsCommand.run(values: values, runtime: runtime)
  }

  /// Body pulled out of the CommandSpec closure so Swift's strict concurrency mode can
  /// reason about the isolation of `ContactResolver` (an actor) separately from the static
  /// `spec` initialization.
  static func run(values: ParsedValues, runtime: RuntimeOptions) async throws {
    let dbPath = values.option("db") ?? MessageStore.defaultPath
    let limit = values.optionInt("limit") ?? 20
    let resolveContacts = values.flag("contacts")
    let inlineAvatars = values.flag("inlineAvatars")
    let store = try MessageStore(path: dbPath)
    let chats = try store.listChats(limit: limit)

    let resolver: ContactResolver?
    if resolveContacts {
      let r = ContactResolver()
      await r.loadIfNeeded()
      resolver = r
    } else {
      resolver = nil
    }
    let delivery: ContactResolver.AvatarDelivery = inlineAvatars ? .inline : .filePath

    if runtime.jsonOutput {
      for chat in chats {
        if let resolver {
          let participants = (try? store.participants(chatID: chat.id)) ?? []
          let map = await resolver.resolveMany(participants, delivery: delivery)
          let resolved = participants.map { map[$0] ?? ResolvedContact.unresolved(handle: $0) }
          let payload = ChatListPayload(
            id: chat.id,
            name: chat.name,
            identifier: chat.identifier,
            guid: "",
            service: chat.service,
            lastMessageAt: CLIISO8601.format(chat.lastMessageAt),
            preview: chat.preview,
            participants: participants,
            isGroup: chat.identifier.contains(";+;"),
            participantsResolved: resolved
          )
          try StdoutWriter.writeJSONLine(payload)
        } else {
          try StdoutWriter.writeJSONLine(ChatPayload(chat: chat))
        }
      }
      return
    }

    for chat in chats {
      let last = CLIISO8601.format(chat.lastMessageAt)
      StdoutWriter.writeLine("[\(chat.id)] \(chat.name) (\(chat.identifier)) last=\(last)")
      if let resolver {
        let participants = (try? store.participants(chatID: chat.id)) ?? []
        if !participants.isEmpty {
          let map = await resolver.resolveMany(participants, delivery: delivery)
          let rendered = participants.map { handle -> String in
            let contact = map[handle] ?? ResolvedContact.unresolved(handle: handle)
            if let name = contact.name { return "\(name) <\(handle)>" }
            return handle
          }
          StdoutWriter.writeLine("  participants: \(rendered.joined(separator: ", "))")
        }
      }
    }
  }
}
