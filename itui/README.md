# itui

A terminal UI for iMessage. Connects to an [`imsg serve`](../) endpoint running on your
Mac — so you can leave a lightweight server next to `Messages.app` and drive it from any
terminal, including over SSH.

## Install

Requires [Bun](https://bun.sh). (OpenTUI is Bun-first today; Node support is in
progress upstream.)

```sh
# One-off run
bunx itui

# Global install
bun install -g itui
itui
```

From this repo while developing:

```sh
cd itui
bun install
bun run src/cli.tsx
```

## First run

On first launch, itui creates `~/.config/itui/config.json` with defaults:

```json
{
  "server": "http://127.0.0.1:8080",
  "token": null,
  "defaultChatId": null,
  "reconnectDelayMs": 2000
}
```

Point it at a different server:

```sh
itui config set server=http://imsg-host.local:8080
```

Or for a single run:

```sh
itui --server=http://imsg-host.local:8080
```

## Remote usage

The iMessage server (`imsg serve`) runs on your Mac. To reach it from another machine,
either expose it on a trusted network or tunnel in over SSH:

```sh
# From your laptop, tunnel :8080 on the Mac to localhost:8080
ssh -N -L 8080:127.0.0.1:8080 user@your-hostname

# In another terminal on the laptop
itui
```

> The imsg server does not currently require auth. `token` is plumbed through for when it
> does. Until then, don't expose the server directly on the public internet — tunnel it.

## Keys

| Key | Action |
| --- | --- |
| `↑` / `↓` or `k` / `j` | move in the chat list |
| `Enter` / `→` / `l` | open the selected chat |
| `i` | focus the composer |
| `Tab` | cycle focus (chats → messages → composer) |
| `Esc` / `←` / `h` | step focus back |
| `r` | reload chats |
| `q` or `Ctrl+C` | quit |

When the composer has focus, `Enter` sends and `Esc` returns focus to the conversation.

## Config commands

```sh
itui config                    # show path + current values
itui config path               # print only the path
itui config set server=URL     # set one key
itui config set token=...      # set bearer token (or `null` to clear)
itui config reset              # restore defaults
```

## How it connects

All traffic goes over the imsg HTTP + SSE API:

- `GET /api/chats` for the sidebar
- `GET /api/chats/:id/messages` when a chat opens
- `GET /api/events` (server-sent events) for live new messages + reactions
- `POST /api/send` when you submit the composer

Every message payload carries resolved contact data (name, initials, avatar URL) and
typed attachment metadata, which is what powers the bold names, reactions, and `[image]`
hints you see on-screen.
