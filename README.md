# itui

iMessage in your terminal and browser. Run the server on your Mac, connect from anywhere.

```
┌─ Chats ─────────────────────┐┌────────────────── Alex ───────────────────────┐
│ ● Alex                9:48a ││                  ── Today ──                   │
│   Mom                  9:41a ││                                                │
│   Work Chat           9:16a ││  Want to grab dinner tonight?                  │
│   Sam                  7:20a ││  3:10 PM                                       │
│   Reminders           3:25a ││                                                │
│                             ││                            Sure, sounds good   │
│                             ││                                    3:10 PM     │
│                             │├────────────────────────────────────────────────┤
│                             ││ › Message · Enter to send                      │
└─────────────────────────────┘└────────────────────────────────────────────────┘
 ↑↓ nav  ↵ open  i compose  ^N/^P prev/next  ^R reload  q quit  ● live · :13197
```

## Install

One command:

```bash
curl -fsSL https://raw.githubusercontent.com/R44VC0RP/itui/main/install.sh | bash
```

Or clone and run manually:

```bash
git clone https://github.com/R44VC0RP/itui.git
cd itui
./install.sh
```

The installer:
- Builds the `imsg` server binary (Swift, macOS)
- Refreshes the bundled browser assets when Node.js/npm are available
- Installs the optional `itui` TUI client when Bun is available
- Puts `imsg` and, if installed, `itui` in `~/.local/bin`
- Creates `~/.config/itui/config.json` when the TUI is installed
- On macOS, offers to install a LaunchAgent so `imsg serve` runs on login

The server defaults to port `13197` (chosen to avoid collisions with the usual
dev-server ports). Override with `--port` on the CLI or `ITUI_PORT=...` during
install. For non-interactive installs (e.g. `curl | bash`), set
`ITUI_INSTALL_DAEMON=1` to install the LaunchAgent without prompting.

To update an existing install, run the same installer command again:

```bash
curl -fsSL https://raw.githubusercontent.com/R44VC0RP/itui/main/install.sh | bash
```

You do not need to clone the repo or use `git` for normal installs or updates.

### Requirements

**Server / browser runtime (macOS only)**
- macOS 14+ with Messages.app signed in
- Xcode Command Line Tools (`xcode-select --install`)
- Full Disk Access for the app or shell that launches `imsg`
- Optional: Node.js `20.19+` + npm if you want the installer to rebuild the bundled browser app from source

**TUI client (optional)**
- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)

## Quick start

### Installed browser runtime

Start the server on your Mac and open it in a browser:

```bash
imsg serve --host 127.0.0.1 --port 13197

# then open:
http://127.0.0.1:13197
```

If you plan to launch `imsg serve` over SSH or another background context, run it once locally first so macOS can show the Contacts and Automation permission prompts.

If you accepted the LaunchAgent install during setup, `imsg serve` should start automatically on login. The most useful service commands are:

```bash
# restart the background service
launchctl kickstart -k gui/$(id -u)/com.r44vc0rp.itui.imsg

# inspect status
launchctl print gui/$(id -u)/com.r44vc0rp.itui.imsg
```

### Optional Tailscale Serve

Keep `imsg serve` bound to localhost and let Tailscale publish it inside your tailnet:

```bash
tailscale serve --bg 13197
tailscale serve status
```

Then open the HTTPS URL shown by `tailscale serve status` from another device in your tailnet.

This project does not manage Tailscale for you. The documented path is user-managed and optional.

### Optional TUI client

```bash
itui
```

### Repo development

If you are working from this repo, bundle the current web app into the Swift
server first:

```bash
make web-build
swift build -c debug --product imsg
./.build/debug/imsg serve --host 127.0.0.1 --port 13197
```

`imsg serve` serves the last copied browser bundle from
`Sources/imsg/Resources/web/`. If you changed anything under `web/`, run
`make web-build` again before testing the browser through `:13197`.

## Remote access without Tailscale

The server runs on your Mac. Connect from anywhere:

```bash
# SSH tunnel from your laptop
ssh -N -L 13197:127.0.0.1:13197 you@your-mac.local

# Then open the browser app at http://127.0.0.1:13197
# or run itui — it connects to localhost:13197 by default
itui
```

Or point directly at a host on your network:

```bash
# browser
open http://imsg-host.local:13197

# TUI
itui --server=http://imsg-host.local:13197
# or persist it:
itui config set server=http://imsg-host.local:13197
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Your Mac                           │
│                                                         │
│  Messages.app ← → chat.db ← → imsg serve (:13197)      │
│                                    │                    │
│                    ┌───────────────┼───────────────┐    │
│                    │ HTTP API      │ SSE stream    │    │
│                    │ /api/chats    │ /api/events   │    │
│                    │ /api/send     │               │    │
│                    │ /api/contacts │               │    │
│                    └───────────────┼───────────────┘    │
└────────────────────────────────────┼────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │  Browser app + itui TUI client │
                    │           run anywhere          │
                    └─────────────────────────────────┘
```

**`imsg serve`** — Swift HTTP server that reads `chat.db`, resolves contacts + avatars, and exposes a full REST + SSE API. Runs on your Mac next to Messages.app.

**Browser app** — Static frontend bundle served directly by `imsg serve`. The runtime remains a single macOS service.

**`itui`** — OpenTUI (React) terminal client. Connects to the server over HTTP. Runs on any machine with Bun.

## Keyboard shortcuts

### Sidebar focused

| Key | Action |
| --- | --- |
| `↑` / `↓` or `k` / `j` | Navigate chats |
| `Enter` / `→` / `l` | Open chat |
| `i` or `c` | Jump to composer |

### Messages focused

| Key | Action |
| --- | --- |
| `Esc` / `←` / `h` | Back to sidebar |
| `i` or `Enter` | Jump to composer |

### Composer focused

| Key | Action |
| --- | --- |
| `Enter` | Send message |
| `Ctrl+C` | Clear input (or close if empty) |
| `Esc` | Close composer |

### Global

| Key | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Cycle panels |
| `Ctrl+N` / `Ctrl+P` | Next / previous chat |
| `Ctrl+R` | Reload chat list |
| `q` or `Ctrl+C` | Quit (outside composer) |

## Configuration

Config lives at `~/.config/itui/config.json`:

```json
{
  "server": "http://127.0.0.1:13197",
  "token": null,
  "defaultChatId": null,
  "reconnectDelayMs": 2000
}
```

```bash
itui config                         # show current config
itui config set server=http://...   # update a key
itui config set token=bearer-xxx    # set auth token (future)
itui config reset                   # restore defaults
itui config path                    # print config file path
```

## API endpoints

The `imsg serve` HTTP API can be used by any client, not just `itui`.

| Endpoint | Description |
| --- | --- |
| `GET /api/chats` | List chats with resolved contacts |
| `GET /api/chats/:id/messages` | Messages with sender contacts + attachment URLs |
| `GET /api/contacts` | All resolved contacts (name, initials, avatar) |
| `GET /api/contacts/resolve?handle=...` | Resolve a single handle |
| `GET /api/contacts/avatar?handle=...` | Stream avatar image |
| `GET /api/attachments/:id` | Stream attachment file |
| `GET /api/attachments/:id/preview` | Stream a browser-safe derived preview when needed |
| `GET /api/events` | SSE stream of new messages |
| `POST /api/uploads` | Stage an attachment for browser send flows |
| `POST /api/send` | Send a message |
| `GET /debug` | Debug page for verifying contacts + avatars |

## CLI commands (imsg)

```bash
imsg chats [--limit 20] [--contacts] [--json]
imsg history --chat-id <id> [--limit 50] [--contacts] [--attachments] [--json]
imsg watch [--chat-id <id>] [--contacts] [--attachments] [--json]
imsg send --to <handle> --text "hi" [--service imessage|sms|auto]
imsg react --chat-id <id> --reaction like
imsg contacts [--handle +15551234567] [--json]
imsg serve [--host 127.0.0.1] [--port 13197]
imsg rpc   # JSON-RPC over stdio
```

## macOS permissions

On first run, macOS will prompt you for:

1. **Full Disk Access** — required to read `~/Library/Messages/chat.db`. Grant to your terminal app in System Settings → Privacy & Security → Full Disk Access.

2. **Contacts** — optional, for resolving names + avatars. A prompt appears on first use; deny and handles show as phone numbers.

3. **Automation (Messages.app)** — required only for sending. A prompt appears on first send.

## Development

```bash
# Server
make build              # release build → bin/imsg
make test               # run Swift tests
make lint               # swift-format + swiftlint

# Browser client (live frontend dev)
make web-dev            # Vite dev server for web/

# Browser client (bundled into imsg serve)
make web-build          # build web/ and copy into Sources/imsg/Resources/web/

# Browser client with a separate backend
cp web/.env.example web/.env.local
# set VITE_IMSG_PROXY_TARGET=http://127.0.0.1:13197

# TUI client
cd itui
bun install
bun run src/cli.tsx     # run in dev mode
bun run typecheck       # tsc --noEmit
```

When the backend is running on another machine during frontend development,
point `VITE_IMSG_PROXY_TARGET` at that `imsg serve` instance directly or use an
SSH tunnel first. If you are testing through `imsg serve` instead of Vite, run
`make web-build` first so the bundled assets are current.

## Credits

Server built on [steipete/imsg](https://github.com/steipete/imsg). TUI built with [OpenTUI](https://opentui.com).

## License

MIT
