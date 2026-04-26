import Commander
import Foundation

enum ServiceCommand {
  static let label = "com.r44vc0rp.itui.imsg"
  static let defaultPort = 13197

  static let spec = CommandSpec(
    name: "service",
    abstract: "Manage the background web server",
    discussion: """
      Installs and controls the macOS LaunchAgent that runs `imsg serve` on login.
      Use this for normal start, stop, restart, status, and log checks.
      """,
    signature: CommandSignatures.withRuntimeFlags(
      CommandSignature(
        arguments: [
          .make(
            label: "action",
            help: "install, start, stop, restart, status, logs, permissions, uninstall",
            isOptional: true)
        ],
        options: [
          .make(label: "host", names: [.long("host")], help: "Bind address (default: 127.0.0.1)"),
          .make(label: "port", names: [.long("port")], help: "Listen port (default: 13197)"),
          .make(
            label: "binary", names: [.long("binary")],
            help: "Binary path to use in the LaunchAgent (defaults to this executable)"),
        ],
        flags: [
          .make(label: "follow", names: [.short("f"), .long("follow")], help: "Follow logs")
        ])
    ),
    usageExamples: [
      "imsg service install",
      "imsg service status",
      "imsg service restart",
      "imsg service logs -f",
      "imsg service permissions",
    ]
  ) { values, runtime in
    try await ServiceCommand.run(values: values, runtime: runtime)
  }

  static func run(values: ParsedValues, runtime: RuntimeOptions) async throws {
    let manager = ServiceManager(
      host: values.option("host") ?? "127.0.0.1",
      port: values.optionInt("port") ?? defaultPort,
      binaryPath: values.option("binary") ?? currentExecutablePath()
    )
    let action = values.argument(0) ?? "status"

    switch action {
    case "install":
      try manager.install()
      try manager.start()
      await manager.printStatus(json: runtime.jsonOutput)
    case "start":
      try manager.start()
      await manager.printStatus(json: runtime.jsonOutput)
    case "stop":
      try manager.stop()
      if runtime.jsonOutput {
        try StdoutWriter.writeJSONLine(["status": "stopped"])
      } else {
        StdoutWriter.writeLine("Stopped \(label)")
      }
    case "restart":
      try manager.stop()
      try manager.start()
      await manager.printStatus(json: runtime.jsonOutput)
    case "status":
      await manager.printStatus(json: runtime.jsonOutput)
    case "logs":
      try manager.logs(follow: values.flag("follow"))
    case "permissions":
      try manager.openPermissions()
    case "uninstall":
      try manager.stop()
      try manager.uninstall()
      if runtime.jsonOutput {
        try StdoutWriter.writeJSONLine(["status": "uninstalled"])
      } else {
        StdoutWriter.writeLine("Uninstalled \(label)")
      }
    default:
      throw ServiceCommandError.process("Unknown service action: \(action)")
    }
  }

  private static func currentExecutablePath() -> String {
    let rawPath = CommandLine.arguments.first ?? Bundle.main.executablePath ?? "imsg"
    let url = URL(fileURLWithPath: rawPath)
    if url.path.contains("/") {
      return url.resolvingSymlinksInPath().path
    }
    return Bundle.main.executableURL?.resolvingSymlinksInPath().path ?? rawPath
  }
}

struct ServiceStatusPayload: Codable {
  let installed: Bool
  let loaded: Bool
  let state: String?
  let healthy: Bool
  let contacts: String?
  let url: String
  let plistPath: String
  let binaryPath: String
  let logPath: String
  let errorLogPath: String
}

struct ServiceManager {
  let host: String
  let port: Int
  let binaryPath: String

  private var home: String {
    FileManager.default.homeDirectoryForCurrentUser.path
  }

  private var uid: String {
    String(getuid())
  }

  private var launchTarget: String {
    "gui/\(uid)"
  }

  var label: String {
    ServiceCommand.label
  }

  var url: String {
    "http://\(host):\(port)"
  }

  var plistPath: String {
    "\(home)/Library/LaunchAgents/\(label).plist"
  }

  var logDir: String {
    "\(home)/.itui/logs"
  }

  var logPath: String {
    "\(logDir)/imsg.log"
  }

  var errorLogPath: String {
    "\(logDir)/imsg.err.log"
  }

  var manualPidPath: String {
    "\(home)/.itui/imsg.manual.pid"
  }

  func install() throws {
    try FileManager.default.createDirectory(
      atPath: (plistPath as NSString).deletingLastPathComponent,
      withIntermediateDirectories: true)
    try FileManager.default.createDirectory(atPath: logDir, withIntermediateDirectories: true)
    stopManualFallback()
    try stop()
    try renderPlist().write(toFile: plistPath, atomically: true, encoding: .utf8)
    try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: plistPath)
  }

  func uninstall() throws {
    try? FileManager.default.removeItem(atPath: plistPath)
  }

  func start() throws {
    stopManualFallback()
    if !isLoaded() {
      let result = runProcess("/bin/launchctl", ["bootstrap", launchTarget, plistPath])
      if result.status != 0, !isLoaded() {
        throw ServiceCommandError.launchctl(result.stderrOrStdout)
      }
    }
    _ = runProcess("/bin/launchctl", ["kickstart", "-k", "\(launchTarget)/\(label)"])
  }

  func stop() throws {
    if isLoaded() {
      _ = runProcess("/bin/launchctl", ["bootout", launchTarget, plistPath])
      _ = runProcess("/bin/launchctl", ["bootout", "\(launchTarget)/\(label)"])
    }
  }

  func logs(follow: Bool) throws {
    let paths = [logPath, errorLogPath].filter { FileManager.default.fileExists(atPath: $0) }
    guard !paths.isEmpty else {
      StdoutWriter.writeLine("No logs found yet.")
      StdoutWriter.writeLine("Expected:")
      StdoutWriter.writeLine("  \(logPath)")
      StdoutWriter.writeLine("  \(errorLogPath)")
      return
    }
    let args = follow ? ["-f"] + paths : ["-n", "80"] + paths
    let result = runProcess("/usr/bin/tail", args, inheritOutput: true)
    if result.status != 0 {
      throw ServiceCommandError.process("tail failed")
    }
  }

  func openPermissions() throws {
    _ = runProcess(
      "/usr/bin/open",
      [
        "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
      ])
    _ = runProcess(
      "/usr/bin/open",
      [
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts"
      ])
    StdoutWriter.writeLine("Opened macOS Privacy settings.")
    StdoutWriter.writeLine("Grant Full Disk Access and Contacts access to:")
    StdoutWriter.writeLine("  \(binaryPath)")
  }

  func printStatus(json: Bool) async {
    let payload = await status()
    if json {
      try? StdoutWriter.writeJSONLine(payload)
      return
    }

    StdoutWriter.writeLine("Service: \(label)")
    StdoutWriter.writeLine("Installed: \(payload.installed ? "yes" : "no")")
    StdoutWriter.writeLine("Loaded: \(payload.loaded ? "yes" : "no")")
    if let state = payload.state {
      StdoutWriter.writeLine("State: \(state)")
    }
    StdoutWriter.writeLine("Web: \(payload.healthy ? "healthy" : "not healthy")")
    if let contacts = payload.contacts {
      StdoutWriter.writeLine("Contacts: \(contacts)")
    }
    StdoutWriter.writeLine("URL: \(payload.url)")

    if !payload.installed {
      StdoutWriter.writeLine("")
      StdoutWriter.writeLine("Install the background service with:")
      StdoutWriter.writeLine("  imsg service install")
    }

    if payload.installed && !payload.healthy {
      StdoutWriter.writeLine("")
      StdoutWriter.writeLine("If this is a daemon install, grant Full Disk Access to:")
      StdoutWriter.writeLine("  \(payload.binaryPath)")
      StdoutWriter.writeLine("Then run:")
      StdoutWriter.writeLine("  imsg service restart")
    }

    if payload.contacts == "denied" || payload.contacts == "not_determined" {
      StdoutWriter.writeLine("")
      StdoutWriter.writeLine("To show contact names and avatars, grant Contacts access to:")
      StdoutWriter.writeLine("  \(payload.binaryPath)")
      StdoutWriter.writeLine("You can open privacy settings with:")
      StdoutWriter.writeLine("  imsg service permissions")
    }
  }

  func status() async -> ServiceStatusPayload {
    let launchOutput = launchctlPrint()
    let health = await request(path: "/api/chats?limit=1")
    let contacts = await contactsAuthorization()
    return ServiceStatusPayload(
      installed: FileManager.default.fileExists(atPath: plistPath),
      loaded: launchOutput != nil,
      state: launchOutput.flatMap(Self.parseLaunchState),
      healthy: health != nil,
      contacts: contacts,
      url: url,
      plistPath: plistPath,
      binaryPath: binaryPath,
      logPath: logPath,
      errorLogPath: errorLogPath
    )
  }

  func renderPlist() -> String {
    let escapedBinaryPath = binaryPath.xmlEscaped
    let escapedHost = host.xmlEscaped
    let escapedHome = home.xmlEscaped
    let escapedLogPath = logPath.xmlEscaped
    let escapedErrorLogPath = errorLogPath.xmlEscaped

    return """
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
          <key>Label</key>
          <string>\(label)</string>
          <key>ProgramArguments</key>
          <array>
              <string>\(escapedBinaryPath)</string>
              <string>serve</string>
              <string>--host</string>
              <string>\(escapedHost)</string>
              <string>--port</string>
              <string>\(port)</string>
          </array>
          <key>RunAtLoad</key>
          <true/>
          <key>KeepAlive</key>
          <dict>
              <key>SuccessfulExit</key>
              <false/>
              <key>Crashed</key>
              <true/>
          </dict>
          <key>ThrottleInterval</key>
          <integer>5</integer>
          <key>ProcessType</key>
          <string>Interactive</string>
          <key>StandardOutPath</key>
          <string>\(escapedLogPath)</string>
          <key>StandardErrorPath</key>
          <string>\(escapedErrorLogPath)</string>
          <key>EnvironmentVariables</key>
          <dict>
              <key>HOME</key>
              <string>\(escapedHome)</string>
          </dict>
      </dict>
      </plist>
      """
  }

  private func isLoaded() -> Bool {
    launchctlPrint() != nil
  }

  private func launchctlPrint() -> String? {
    let result = runProcess("/bin/launchctl", ["print", "\(launchTarget)/\(label)"])
    return result.status == 0 ? result.stdout : nil
  }

  private func contactsAuthorization() async -> String? {
    guard let data = await request(path: "/api/contacts") else { return nil }
    guard
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let authorization = object["authorization"] as? String
    else {
      return nil
    }
    return authorization
  }

  private func request(path: String) async -> Data? {
    guard let requestURL = URL(string: "\(url)\(path)") else { return nil }
    do {
      let (data, response) = try await URLSession.shared.data(from: requestURL)
      guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
        return nil
      }
      return data
    } catch {
      return nil
    }
  }

  private func stopManualFallback() {
    guard
      let pid = try? String(contentsOfFile: manualPidPath, encoding: .utf8)
        .trimmingCharacters(in: .whitespacesAndNewlines),
      !pid.isEmpty
    else {
      return
    }
    _ = runProcess("/bin/kill", [pid])
    try? FileManager.default.removeItem(atPath: manualPidPath)
  }

  private static func parseLaunchState(_ output: String) -> String? {
    output.split(separator: "\n").compactMap { line -> String? in
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      guard trimmed.hasPrefix("state = ") else { return nil }
      return String(trimmed.dropFirst("state = ".count))
    }.first
  }
}

enum ServiceCommandError: LocalizedError {
  case launchctl(String)
  case process(String)

  var errorDescription: String? {
    switch self {
    case .launchctl(let message):
      return "launchctl failed: \(message)"
    case .process(let message):
      return message
    }
  }
}

private struct ProcessResult {
  let status: Int32
  let stdout: String
  let stderr: String

  var stderrOrStdout: String {
    let message = stderr.isEmpty ? stdout : stderr
    return message.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}

private func runProcess(
  _ executable: String,
  _ arguments: [String],
  inheritOutput: Bool = false
) -> ProcessResult {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: executable)
  process.arguments = arguments

  let stdoutPipe = Pipe()
  let stderrPipe = Pipe()
  if inheritOutput {
    process.standardOutput = FileHandle.standardOutput
    process.standardError = FileHandle.standardError
  } else {
    process.standardOutput = stdoutPipe
    process.standardError = stderrPipe
  }

  do {
    try process.run()
    process.waitUntilExit()
  } catch {
    return ProcessResult(status: 127, stdout: "", stderr: String(describing: error))
  }

  let stdout =
    inheritOutput
    ? ""
    : String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
  let stderr =
    inheritOutput
    ? ""
    : String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
  return ProcessResult(status: process.terminationStatus, stdout: stdout, stderr: stderr)
}

extension String {
  fileprivate var xmlEscaped: String {
    replacingOccurrences(of: "&", with: "&amp;")
      .replacingOccurrences(of: "\"", with: "&quot;")
      .replacingOccurrences(of: "'", with: "&apos;")
      .replacingOccurrences(of: "<", with: "&lt;")
      .replacingOccurrences(of: ">", with: "&gt;")
  }
}
