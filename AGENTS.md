# Repository Guidelines

## Project Structure & Module Organization
- `Sources/imsg` holds the CLI entrypoint and command wiring.
- `Sources/IMsgCore` contains SQLite access, watchers, AppleScript send logic, and helpers.
- `bin/` is created by `make build` for local artifacts.

## Build, Test, and Development Commands
- `make imsg` — clean rebuild + run debug CLI (use `ARGS=...`).
- `make build` — universal release build into `bin/`.
- `make lint` — run `swift format` lint + `swiftlint`.
- `make test` — run `swift test` after syncing version + patching deps.
- `make web-serve` — build the browser bundle, build debug `imsg`, and serve it on `127.0.0.1:13197`.

## Runbook
- Local browser runtime:
  - `make web-serve`
  - open `http://127.0.0.1:13197`
  - use this when testing the bundled web app through Swift; it prevents stale browser assets
- Installed browser runtime:
  - recommended install/update: `curl -fsSL https://raw.githubusercontent.com/R44VC0RP/itui/main/install.sh | ITUI_INSTALL_DAEMON=1 bash`
  - status: `imsg service status`
  - restart: `imsg service restart`
  - logs: `imsg service logs -f`
  - open `http://127.0.0.1:13197`
  - for LaunchAgent / daemon mode, Full Disk Access must be granted to `~/.itui/bin/imsg`, not just the terminal app
  - if names and avatars are missing, run `~/.itui/bin/imsg contacts --json` once from the Mac's normal desktop session
- Frontend dev loop:
  - keep an `imsg serve` instance running locally or on a reachable macOS host
  - copy `web/.env.example` to `web/.env.local`
  - set `VITE_IMSG_PROXY_TARGET=http://127.0.0.1:13197` for local dev, or point it at the remote/tunneled backend
  - run `make web-dev`
- Remote host workflow:
  - prefer the installed service on the remote Mac: `imsg service status`
  - either use `VITE_IMSG_PROXY_TARGET=http://your-hostname:13197` if the host resolves on your network
  - or tunnel with `ssh -L 13197:127.0.0.1:13197 user@your-hostname` and use `VITE_IMSG_PROXY_TARGET=http://127.0.0.1:13197`
- Verification loop:
  - `npm --prefix web run lint`
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `scripts/build-web.sh`
  - `swift build -c debug --product imsg`
  - `swift test`
- Optional Tailscale path:
  - keep `imsg serve` on `127.0.0.1:13197`
  - run `tailscale serve --bg 13197`
  - run `tailscale serve status` and use the HTTPS URL it prints
  - this repo does not manage Tailscale lifecycle or auth

## Coding Style & Naming Conventions
- Swift 6 module; prefer concrete types, early returns, and minimal globals.
- Formatting is enforced by `swift format` and `swiftlint`.
- CLI flags use long-form, kebab-case (`--chat-id`, `--attachments`).

## Testing Guidelines
- Unit tests live in `Tests/` as `*Tests.swift`.
- Prefer deterministic fixtures over touching the live Messages DB.
- Add regression tests for fixes touching parsing, filtering, or attachment metadata.

## Commit & Pull Request Guidelines
- Follow the existing short, lowercase prefixes seen in history (`ci:`, `chore:`, `fix:`, `feat:`) with an imperative summary (e.g., `fix: handle missing attachments`).
- PRs should include: brief description, steps to repro/verify, and outputs of `make lint` and `make test`. For CLI changes, include sample commands and before/after snippets.
- Keep changeset focused; avoid drive-by refactors unless they reduce risk or remove duplication in touched areas.

## Security & macOS Permissions
- The tool needs read-only access to `~/Library/Messages/chat.db`; ensure the terminal has Full Disk Access before running tests that touch the DB.
- For installed daemon mode, Full Disk Access must also be granted to `~/.itui/bin/imsg`.
- Sending requires Automation permission for Messages.app and SMS relay configured in macOS/iOS; document any manual steps needed for reviewers.
