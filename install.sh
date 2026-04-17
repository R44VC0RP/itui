#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# itui installer
#
# Sets up both pieces:
#   1. imsg  — the iMessage API server (Swift, macOS only)
#   2. itui  — the terminal UI client  (Bun + OpenTUI, any platform)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/R44VC0RP/itui/main/install.sh | bash
#
# Or clone and run locally:
#   git clone https://github.com/R44VC0RP/itui.git && cd itui && ./install.sh
# ──────────────────────────────────────────────────────────────────────────────

BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()  { echo -e "${BOLD}${GREEN}▸${RESET} $1"; }
warn()  { echo -e "${BOLD}${YELLOW}▸${RESET} $1"; }
error() { echo -e "${BOLD}${RED}▸${RESET} $1"; }
dim()   { echo -e "${DIM}  $1${RESET}"; }

REPO_URL="https://github.com/R44VC0RP/itui.git"
INSTALL_DIR="${ITUI_INSTALL_DIR:-$HOME/.itui}"

# ── Preflight ─────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}  itui installer${RESET}"
echo -e "  iMessage in your terminal"
echo ""

# Check for macOS (server requires it; client works anywhere but the install
# script currently assumes macOS for the full experience).
if [[ "$(uname -s)" != "Darwin" ]]; then
  warn "macOS not detected. The imsg server requires macOS."
  warn "You can still install the itui client and connect to a remote server."
  echo ""
fi

# ── Dependencies ──────────────────────────────────────────────────────────────

check_dep() {
  if ! command -v "$1" &>/dev/null; then
    error "$1 is required but not installed."
    dim "$2"
    return 1
  fi
  return 0
}

MISSING=0

if [[ "$(uname -s)" == "Darwin" ]]; then
  check_dep swift "Install Xcode or Xcode Command Line Tools: xcode-select --install" || MISSING=1
fi

check_dep bun "Install Bun: curl -fsSL https://bun.sh/install | bash" || MISSING=1
check_dep git "Install git via Xcode CLT or Homebrew" || MISSING=1

if [[ "$MISSING" -eq 1 ]]; then
  echo ""
  error "Missing dependencies. Install them and re-run this script."
  exit 1
fi

info "Dependencies OK — swift $(swift --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' || echo 'n/a'), bun $(bun --version)"

# ── Clone / update ────────────────────────────────────────────────────────────

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Updating existing install at $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only || {
    warn "Pull failed — continuing with existing checkout"
  }
else
  info "Cloning to $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── Build the imsg server (macOS only) ────────────────────────────────────────

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo ""
  info "Building imsg server (universal release)…"
  dim "This compiles the Swift binary. First run takes ~30s."

  if [[ -f Makefile ]]; then
    make build 2>&1 | tail -3
  else
    swift build -c release 2>&1 | tail -3
    mkdir -p bin
    cp "$(swift build -c release --show-bin-path)/imsg" bin/imsg 2>/dev/null || true
  fi

  IMSG_BIN="$INSTALL_DIR/bin/imsg"
  if [[ -f "$IMSG_BIN" ]]; then
    info "Server built: $IMSG_BIN"
  else
    # Fallback to debug build path
    IMSG_BIN="$INSTALL_DIR/.build/release/imsg"
    if [[ -f "$IMSG_BIN" ]]; then
      info "Server built: $IMSG_BIN"
    else
      warn "Server binary not found — you can build manually with 'make build'"
    fi
  fi
fi

# ── Install the itui client ──────────────────────────────────────────────────

echo ""
info "Installing itui client…"
cd "$INSTALL_DIR/itui"
bun install --frozen-lockfile 2>/dev/null || bun install
info "Client dependencies installed"

# ── Symlinks ──────────────────────────────────────────────────────────────────

echo ""
info "Creating symlinks…"

BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"

# itui launcher script
cat > "$BIN_DIR/itui" << 'LAUNCHER'
#!/usr/bin/env bash
exec bun run "$HOME/.itui/itui/src/cli.tsx" "$@"
LAUNCHER
chmod +x "$BIN_DIR/itui"
info "  itui  → $BIN_DIR/itui"

# imsg server (macOS only)
if [[ "$(uname -s)" == "Darwin" ]]; then
  if [[ -f "$INSTALL_DIR/bin/imsg" ]]; then
    ln -sf "$INSTALL_DIR/bin/imsg" "$BIN_DIR/imsg"
    info "  imsg  → $BIN_DIR/imsg"
  elif [[ -f "$INSTALL_DIR/.build/release/imsg" ]]; then
    ln -sf "$INSTALL_DIR/.build/release/imsg" "$BIN_DIR/imsg"
    info "  imsg  → $BIN_DIR/imsg"
  fi
fi

# ── PATH check ────────────────────────────────────────────────────────────────

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  warn "$BIN_DIR is not in your PATH."
  dim "Add this to your shell profile (~/.zshrc, ~/.bashrc, etc.):"
  echo ""
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

# ── Config ────────────────────────────────────────────────────────────────────

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/itui"
if [[ ! -f "$CONFIG_DIR/config.json" ]]; then
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_DIR/config.json" << 'CONFIG'
{
  "server": "http://127.0.0.1:8080",
  "token": null,
  "defaultChatId": null,
  "reconnectDelayMs": 2000,
  "hideHandles": true,
  "notifications": true,
  "notificationSound": true
}
CONFIG
  info "Created config at $CONFIG_DIR/config.json"
else
  info "Config already exists at $CONFIG_DIR/config.json"
fi

# ── macOS permissions reminder ────────────────────────────────────────────────

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo ""
  echo -e "${BOLD}  macOS permissions needed:${RESET}"
  echo ""
  echo "  The imsg server reads your Messages database and sends messages"
  echo "  via AppleScript. You'll need to grant:"
  echo ""
  echo "    1. Full Disk Access     → System Settings → Privacy → Full Disk Access"
  echo "       (for your terminal app — iTerm2, Terminal.app, etc.)"
  echo ""
  echo "    2. Contacts Access      → granted on first run (a prompt will appear)"
  echo ""
  echo "    3. Automation (Messages) → granted on first send (a prompt will appear)"
  echo ""
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}  ✓ Installation complete${RESET}"
echo ""
echo "  Quick start:"
echo ""
if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "    1. Start the server:   imsg serve"
  echo "    2. Open the TUI:       itui"
else
  echo "    1. Point at your Mac:  itui config set server=http://your-mac:8080"
  echo "    2. Open the TUI:       itui"
fi
echo ""
echo "  Remote access (from another machine):"
echo ""
echo "    ssh -N -L 8080:127.0.0.1:8080 you@your-mac"
echo "    itui"
echo ""
