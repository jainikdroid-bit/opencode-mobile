#!/bin/sh
# OpenCode Connect for macOS and Linux: set up opencode here and pair the phone app.
#
#   curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
#   sh opencode-connect.sh --doctor | --stop | --dry-run | --json | --mode lan|local|tailscale
#
# Same behaviour as opencode-connect.ps1 (see docs/AI-SETUP.md): idempotent, server bound to 127.0.0.1,
# published only inside your Tailscale network, stable password kept in ~/.config/opencode-connect.
# Exit codes: 0 ok, 1 failed, 2 a human must do something (see "needs" with --json).
# Not auto-installed because they need sudo: Node.js (Linux) and Tailscale; the script tells you the command.
# Not yet tested on macOS: reports welcome.

NOGUIDE=0 MODE=tailscale PORT=4096 NAME=$(hostname) HOST_OVERRIDE= JSON=0 NOQR=0 NOOPEN=0 ROTATE=0 DOCTOR=0 STOP=0 DRY=0
APP_URL=https://github.com/jainikdroid-bit/opencode-mobile/releases/latest
DIR=${OPENCODE_CONNECT_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode-connect}
while [ $# -gt 0 ]; do
  case $1 in
    --mode) MODE=$2; shift ;; --port) PORT=$2; shift ;; --name) NAME=$2; shift ;; --host-name) HOST_OVERRIDE=$2; shift ;;
    --json) JSON=1 ;; --no-guide) NOGUIDE=1 ;; --no-qr) NOQR=1 ;; --no-open) NOOPEN=1 ;; --rotate) ROTATE=1 ;;
    --doctor|--status) DOCTOR=1 ;; --stop) STOP=1 ;; --dry-run) DRY=1 ;; --no-install) ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

GN=0; GT=3; [ "$MODE" = tailscale ] && GT=4
guide() { # title what you
  GN=$((GN + 1)); [ "$JSON" = 1 ] || [ "$NOGUIDE" = 1 ] || [ "$DRY" = 1 ] && return 0
  say ""; say "Step $GN/$GT: $1"; say "  $2"; say "  You: $3"
}
say() { if [ "$JSON" = 1 ]; then echo "$*" >&2; else echo "$*"; fi; }
json_out() { # ok stage needs message [extra-json-fragment]
  [ "$JSON" = 1 ] || return 0
  printf '{"ok":%s,"stage":"%s","needs":%s,"message":"%s","appUrl":"%s","mode":"%s"%s}\n' "$1" "$2" "$3" "$4" "$APP_URL" "$MODE" "$5"
}
fail() { say "[x] $1: $2"; json_out false "$1" null "$2"; exit 1; }
need() { say "[!] $1: $2"; json_out false "$1" "\"$1\"" "$2" "$3"; exit 2; }
have() { command -v "$1" >/dev/null 2>&1 && { [ "$1" != node ] || node -v >/dev/null 2>&1; }; }
health() { curl -fsS -m 4 -u "opencode:$1" "http://127.0.0.1:$2/global/health" >/dev/null 2>&1; }
listening() { (ss -ltn 2>/dev/null || netstat -an 2>/dev/null) | grep -E "[.:]$1[[:space:]].*LISTEN" >/dev/null 2>&1; }
ts_cmd() { if have tailscale; then echo tailscale; elif [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then echo /Applications/Tailscale.app/Contents/MacOS/Tailscale; fi; }

mkdir -p "$DIR"; chmod 700 "$DIR" 2>/dev/null
[ -f "$DIR/port" ] && [ "$PORT" = 4096 ] && PORT=$(cat "$DIR/port")
TS=$(ts_cmd)

if [ "$STOP" = 1 ]; then
  pid=$(cat "$DIR/pid" 2>/dev/null); [ -n "$pid" ] && kill "$pid" 2>/dev/null && say "[+] server stopped"
  [ -n "$TS" ] && "$TS" serve --tcp="$PORT" off >/dev/null 2>&1
  json_out true stopped null ""; exit 0
fi

if [ "$DOCTOR" = 1 ]; then
  pw=$(cat "$DIR/password" 2>/dev/null); ok=false; [ -n "$pw" ] && health "$pw" "$PORT" && ok=true
  tsip=; [ -n "$TS" ] && tsip=$("$TS" ip -4 2>/dev/null | head -1)
  say "node=$(have node && echo yes || echo no) opencode=$(have opencode && echo yes || echo no) tailscale=$([ -n "$TS" ] && echo yes || echo no) ip=$tsip server_healthy=$ok"
  json_out true doctor null "" ",\"doctor\":{\"node\":$(have node && echo true || echo false),\"opencode\":$(have opencode && echo true || echo false),\"tailscaleInstalled\":$([ -n "$TS" ] && echo true || echo false),\"tailscaleIp\":\"$tsip\",\"serverHealthy\":$ok,\"port\":$PORT}"
  exit 0
fi

say ""; say "OpenCode Connect (mode: $MODE)"
GT=3; [ "$MODE" = tailscale ] && GT=4
guide "Prepare this computer" "Installs opencode if it is missing (Node.js must exist)." "nothing"
have node || { [ "$DRY" = 1 ] && say "[!] node would be needed" || {
  if have brew; then say "Installing Node.js (brew)..."; brew install node >/dev/null 2>&1; fi
  have node || need install-node "Node.js is missing. Install it (https://nodejs.org or your package manager), then run this again."; }; }
have node && say "[ok] node"
if ! have opencode; then
  [ "$DRY" = 1 ] && say "[!] would run: npm install -g opencode-ai" || {
    say "Installing opencode (npm)..."
    npm install -g opencode-ai --no-audit --no-fund --silent >/dev/null 2>&1 || npm install -g --prefix "$HOME/.local" opencode-ai --no-audit --no-fund --silent >/dev/null 2>&1
    PATH="$HOME/.local/bin:$PATH"; have opencode || fail opencode "npm install -g opencode-ai failed"; say "[+] opencode installed"; }
else say "[ok] opencode"; fi

TSIP=
if [ "$MODE" = tailscale ]; then
  guide "Private link (Tailscale)" "Connects your phone and this computer privately, from anywhere." "sign in once in the page that opens"
  [ -n "$TS" ] || need install-tailscale "Tailscale is missing. Install it (Linux: curl -fsSL https://tailscale.com/install.sh | sudo sh; macOS: brew install --cask tailscale), then run this again."
  say "[ok] tailscale"
  if ! "$TS" status >/dev/null 2>&1 || "$TS" status 2>&1 | grep -qi "logged out\|NeedsLogin\|stopped"; then
    "$TS" up >"$DIR/ts-up.log" 2>&1 &
    i=0; url=
    while [ $i -lt 120 ]; do
      sleep 2; i=$((i + 1))
      "$TS" status >/dev/null 2>&1 && ! "$TS" status 2>&1 | grep -qi "logged out\|NeedsLogin\|stopped" && break
      url=$(grep -o 'https://login.tailscale.com/[^ ]*' "$DIR/ts-up.log" 2>/dev/null | head -1)
      if [ -n "$url" ] && [ $i -eq 1 -o "$JSON" = 1 ]; then
        [ "$JSON" = 1 ] && need tailscale_login "Open authUrl, sign in to Tailscale, then run this again." ",\"authUrl\":\"$url\""
        say "Sign in to Tailscale (once): $url"
      fi
    done
    "$TS" status >/dev/null 2>&1 || need tailscale_login "Tailscale sign-in was not finished. Run this again after signing in." ",\"authUrl\":\"$url\""
  fi
  TSIP=$("$TS" ip -4 2>/dev/null | head -1); [ -n "$TSIP" ] || fail tailscale "no tailscale IPv4 address"
fi

BIND=127.0.0.1; LINKHOST=127.0.0.1
case $MODE in
  tailscale) LINKHOST=${TSIP:-tailscale-ip} ;;
  lan) LAN=$(hostname -I 2>/dev/null | awk '{print $1}'); [ -n "$LAN" ] || LAN=$(ipconfig getifaddr en0 2>/dev/null); [ -n "$LAN" ] || fail lan "no LAN address"; BIND=$LAN; LINKHOST=$LAN ;;
esac
[ -n "$HOST_OVERRIDE" ] && LINKHOST=$HOST_OVERRIDE
[ "$DRY" = 1 ] && { say "Would start: opencode serve --hostname $BIND --port $PORT; phone connects to http://$LINKHOST:$PORT"; json_out true dry-run null ""; exit 0; }

guide "Start the server" "Runs opencode on this computer, reachable only by you." "nothing"
if [ ! -f "$DIR/password" ] || [ "$ROTATE" = 1 ]; then
  LC_ALL=C tr -dc 'a-km-np-zA-HJ-NP-Z2-9' </dev/urandom | head -c 24 >"$DIR/password"; chmod 600 "$DIR/password"; say "[+] password created"
else say "[ok] password"; fi
PW=$(cat "$DIR/password")

if health "$PW" "$PORT"; then say "[ok] server already running on port $PORT"; else
  if listening "$PORT"; then p=$((PORT + 1)); while listening "$p"; do p=$((p + 1)); done; PORT=$p; say "[+] port busy, using $PORT"; fi
  OPENCODE_SERVER_PASSWORD="$PW" nohup opencode serve --hostname "$BIND" --port "$PORT" >"$DIR/server.log" 2>&1 &
  echo $! >"$DIR/pid"; i=0
  while [ $i -lt 40 ]; do health "$PW" "$PORT" && break; sleep 0.5; i=$((i + 1)); done
  health "$PW" "$PORT" || fail server "opencode serve did not become healthy; see $DIR/server.log"
  say "[+] server started on $BIND:$PORT"
fi
echo "$PORT" >"$DIR/port"
[ "$MODE" = tailscale ] && "$TS" serve --bg --tcp "$PORT" "tcp://127.0.0.1:$PORT" >/dev/null 2>&1 && say "[ok] tailscale forward tcp/$PORT (tailnet only)"

enc() { printf '%s' "$1" | od -An -v -tu1 | awk '{for(i=1;i<=NF;i++){c=$i; if((c>=48&&c<=57)||(c>=65&&c<=90)||(c>=97&&c<=122)||c==45||c==46||c==95||c==126) printf "%c",c; else printf "%%%02X",c}}'; }
LINK="opencode://connect?url=$(enc "http://$LINKHOST:$PORT")&password=$(enc "$PW")&name=$(enc "$NAME")"

guide "Pair your phone" "Shows a QR code to connect the app." "about 3 taps on the phone"
if [ "$JSON" = 0 ] && [ "$NOGUIDE" = 0 ]; then
  say ""; say "On your phone:"; say "  1. Install the app: $APP_URL (download the APK)."
  [ "$MODE" = tailscale ] && say "  2. Install Tailscale from Google Play and sign in with the same account."
  say "  Then open the app, tap 'Scan QR to pair', point the camera at the QR code, tap Connect."
fi
if [ "$NOQR" = 0 ] && have node; then
  [ -d "$DIR/node_modules/qrcode-terminal" ] || npm install --prefix "$DIR" qrcode qrcode-terminal --no-audit --no-fund --silent >/dev/null 2>&1
  if [ -d "$DIR/node_modules/qrcode-terminal" ] && [ "$JSON" = 0 ]; then
    say ""; say "Point the phone at this code (app: Scan QR to pair):"
    (cd "$DIR" && node -e 'require("qrcode-terminal").generate(process.argv[1],{small:true})' "$LINK")
  fi
fi
[ "$JSON" = 0 ] && { say ""; say "Pairing link (Add Connection > Paste pairing link):"; say "$LINK"; say ""; say "Stop: sh opencode-connect.sh --stop    Check: --doctor"; }
json_out true ready null "Install the app on the phone, then scan the pairing QR or open the pairing link." ",\"serverUrl\":\"http://$LINKHOST:$PORT\",\"pairingLink\":\"$LINK\""
exit 0
