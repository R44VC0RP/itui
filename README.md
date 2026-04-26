# itui

iMessage in your browser and terminal. Run the server on a Mac signed into
Messages.app, then use the browser app or optional terminal UI from that Mac or
from another device.

## What Gets Installed

- `imsg`: the macOS server. It reads `~/Library/Messages/chat.db`, serves the
  browser app, exposes the HTTP API, and sends through Messages.app.
- Browser app: a bundled web client served by `imsg serve`.
- `itui`: an optional terminal UI client. It is installed only when Bun is
  available.
- Optional LaunchAgent: a background service that starts `imsg serve` on login
  and restarts it if it exits.

The default server URL is:

```text
http://127.0.0.1:13197
```

## Install For Browser Use

Recommended install with the background service enabled:

```bash
curl -fsSL https://raw.githubusercontent.com/R44VC0RP/itui/main/install.sh | ITUI_INSTALL_DAEMON=1 bash
```

That command installs or updates the repo, builds `imsg`, installs the bundled
browser app, installs a user LaunchAgent, and starts `imsg serve` on
`127.0.0.1:13197`. No manual `git` commands are needed for normal installs or
updates.

After the installer finishes, run:

```bash
imsg service status
```

If the status says the web server is not healthy, open the macOS privacy panes:

```bash
imsg service permissions
```

Grant Full Disk Access to the installed server binary:

```text
~/.itui/bin/imsg
```

Then restart and check again:

```bash
imsg service restart
imsg service status
```

When `imsg service status` shows `Web: healthy`, open:

```text
http://127.0.0.1:13197
```

Contacts and Automation permissions may still prompt the first time you resolve
contacts or send a message. Run those steps from the Mac's normal desktop
session, not only over SSH, so macOS can show permission prompts.

If you do not want the background service, run the installer without
`ITUI_INSTALL_DAEMON=1` and start the server manually:

```bash
curl -fsSL https://raw.githubusercontent.com/R44VC0RP/itui/main/install.sh | bash
imsg serve --host 127.0.0.1 --port 13197
```

## macOS Permissions

macOS permissions are required because the server reads Messages data and sends
through Messages.app.

1. Full Disk Access

   For background service installs, grant Full Disk Access to:

   ```text
   ~/.itui/bin/imsg
   ```

   For manual runs, grant Full Disk Access to the terminal app that launches
   `imsg serve`.

2. Contacts

   Contacts are used for names and avatars. Run this once from the Mac's normal
   desktop session if names show up as phone numbers:

   ```bash
   ~/.itui/bin/imsg contacts --json
   ```

3. Automation

   Sending messages requires Messages.app automation permission. macOS prompts
   the first time you send.

You can open the relevant privacy panes with:

```bash
imsg service permissions
```

After changing permissions, restart the background service:

```bash
imsg service restart
```

## Service Commands

Use `imsg service` for the installed background server. These commands replace
the raw `launchctl` commands.

```bash
imsg service status       # check install, daemon, contacts, and web health
imsg service restart      # restart the background server
imsg service stop         # stop the background server
imsg service start        # start the background server
imsg service logs         # show recent logs
imsg service logs -f      # follow logs
imsg service permissions  # open macOS privacy settings
imsg service uninstall    # remove the LaunchAgent
```

If `imsg service status` says the web server is not healthy, grant Full Disk
Access to `~/.itui/bin/imsg`, then run `imsg service restart`.

## Update

Run the same installer command again:

```bash
curl -fsSL https://raw.githubusercontent.com/R44VC0RP/itui/main/install.sh | ITUI_INSTALL_DAEMON=1 bash
```

You do not need to clone the repo or run `git` for normal installs or updates.
If a background service already exists, the installer refreshes and restarts it.

## Use From Another Device

Keep `imsg serve` bound to localhost on the Mac, then publish it inside your
tailnet with Tailscale Serve:

```bash
tailscale serve --bg 13197
tailscale serve status
```

Open the HTTPS URL shown by `tailscale serve status` from another device in your
tailnet.

Without Tailscale, use an SSH tunnel:

```bash
ssh -N -L 13197:127.0.0.1:13197 you@your-mac.local
```

Then open `http://127.0.0.1:13197` on the client machine.

The server has no built-in auth yet. Do not bind it directly to a public
interface.

## Optional TUI

The terminal UI requires Bun. If Bun is installed during setup, the installer
adds the `itui` command:

```bash
itui
```

Point the TUI at another server:

```bash
itui --server=http://your-mac.local:13197
itui config set server=http://your-mac.local:13197
```

TUI config lives at:

```text
~/.config/itui/config.json
```

## Requirements

Server and browser runtime:

- macOS 14+
- Messages.app signed in
- Xcode Command Line Tools: `xcode-select --install`
- `git`
- Full Disk Access for the process that launches `imsg`
- Optional: Node.js `20.19+` and npm to rebuild the bundled browser app during install

Optional TUI:

- Bun: `curl -fsSL https://bun.sh/install | bash`

## Architecture

```text
Your Mac
  Messages.app <-> chat.db <-> imsg serve (:13197)
                                |
                                | HTTP API + SSE events
                                |
                 browser app, itui TUI, or custom client
```

`imsg serve` is the only runtime server. The browser app is static frontend
assets served by that Swift process.

## CLI Commands

```bash
imsg serve [--host 127.0.0.1] [--port 13197]
imsg service [install|start|stop|restart|status|logs|permissions|uninstall]
imsg chats [--limit 20] [--contacts] [--json]
imsg history --chat-id <id> [--limit 50] [--contacts] [--attachments] [--json]
imsg watch [--chat-id <id>] [--contacts] [--attachments] [--json]
imsg send --to <handle> --text "hi" [--service imessage|sms|auto]
imsg react --chat-id <id> --reaction like
imsg contacts [--handle +15551234567] [--json]
imsg rpc
```

## API Endpoints

The HTTP API can be used by any client.

| Endpoint | Description |
| --- | --- |
| `GET /api/chats` | List chats with resolved contacts |
| `GET /api/chats/:id/messages` | Messages with sender contacts and attachment URLs |
| `GET /api/contacts` | All resolved contacts |
| `GET /api/contacts/resolve?handle=...` | Resolve a single handle |
| `GET /api/contacts/avatar?handle=...` | Stream avatar image |
| `GET /api/attachments/:id` | Stream attachment file |
| `GET /api/attachments/:id/preview` | Stream a browser-safe preview |
| `GET /api/events` | SSE stream of new messages |
| `POST /api/uploads` | Stage an attachment for browser send flows |
| `POST /api/send` | Send a message |
| `GET /debug` | Debug page for contacts and avatars |

## Development

Run the bundled browser app through the Swift server:

```bash
make web-serve
```

That command builds `web/`, copies it into `Sources/imsg/Resources/web/`, builds
the debug `imsg` binary, and serves `http://127.0.0.1:13197`.

Frontend-only dev loop:

```bash
cp web/.env.example web/.env.local
# set VITE_IMSG_PROXY_TARGET=http://127.0.0.1:13197
make web-dev
```

Verification:

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test
scripts/build-web.sh
swift build -c debug --product imsg
swift test
```

TUI development:

```bash
cd itui
bun install
bun run src/cli.tsx
bun run typecheck
```

## Credits

Server built on [steipete/imsg](https://github.com/steipete/imsg). TUI built
with [OpenTUI](https://opentui.com).

## License

MIT
