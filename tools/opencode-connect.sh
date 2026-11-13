#!/bin/sh
# OpenCode Connect (macOS / Linux launcher): makes sure Node.js exists, then runs tools/connect.js, the cross-platform core.
#
#   curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
#   curl -fsSL .../opencode-connect.sh | sh -s -- --no-guide --mode lan     # flags go after "--"
#
# Flags: --mode tailscale|lan|local --port N --name X --json --no-guide --no-open --no-qr --rotate
#        --no-autostart --no-install --dry-run --doctor --stop --uninstall
# Exit codes: 0 ok, 1 failed, 2 a human has to do something (see "needs" in the --json output).
BASE_URL="https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools"
DIR="${OPENCODE_CONNECT_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode-connect}"

json=0; noinstall=0
for a in "$@"; do
  case "$a" in --json) json=1 ;; --no-install|--dry-run) noinstall=1 ;; esac
done
say() { if [ "$json" = 1 ]; then printf '%s\n' "$*" >&2; else printf '%s\n' "$*"; fi; }

have_node() { command -v node >/dev/null 2>&1 && node -v >/dev/null 2>&1; }

if ! have_node && [ "$noinstall" = 0 ]; then
  say "Installing Node.js (your system may ask for permission)..."
  if command -v brew >/dev/null 2>&1; then brew install node >/dev/null 2>&1
  elif command -v apt-get >/dev/null 2>&1; then sudo apt-get install -y nodejs npm >/dev/null 2>&1
  elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y nodejs npm >/dev/null 2>&1
  elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --noconfirm nodejs npm >/dev/null 2>&1
  fi
fi
if ! have_node; then
  msg="Node.js is missing. Install it from https://nodejs.org and run this again."
  if [ "$json" = 1 ]; then printf '{"ok":false,"stage":"node","needs":"install-node","message":"%s"}\n' "$msg"; else say "$msg"; fi
  exit 2
fi

# connect.js lives next to this script in a checkout; otherwise download it with its two helpers
here=""
case "$0" in */*) here="$(cd "$(dirname "$0")" 2>/dev/null && pwd)" ;; esac
if [ -n "$here" ] && [ -f "$here/connect.js" ]; then
  core="$here"
else
  core="$DIR/core"
  mkdir -p "$core"
  for f in connect.js launcher.js acp-bridge.js autostart.js phone-bridge.js phone-mcp.js gateway.js tunnel.js; do
    curl -fsSL "$BASE_URL/$f" -o "$core/$f" || { say "Could not download $f"; exit 1; }
  done
fi
exec node "$core/connect.js" "$@"
