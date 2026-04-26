import Testing

@testable import imsg

@Test
func serviceManagerRendersLaunchAgentPlist() {
  let manager = ServiceManager(host: "127.0.0.1", port: 5555, binaryPath: "/tmp/imsg")
  let plist = manager.renderPlist()

  #expect(plist.contains("<string>com.r44vc0rp.itui.imsg</string>"))
  #expect(plist.contains("<string>/tmp/imsg</string>"))
  #expect(plist.contains("<string>serve</string>"))
  #expect(plist.contains("<string>127.0.0.1</string>"))
  #expect(plist.contains("<string>5555</string>"))
  #expect(plist.contains("<key>RunAtLoad</key>"))
  #expect(plist.contains("<key>KeepAlive</key>"))
}

@Test
func rootHelpIncludesServiceCommand() async {
  let router = CommandRouter()
  let (output, status) = await StdoutCapture.capture {
    await router.run(argv: ["imsg", "--help"])
  }

  #expect(status == 0)
  #expect(output.contains("service"))
  #expect(output.contains("Manage the background web server"))
}
