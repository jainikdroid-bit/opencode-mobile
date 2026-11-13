# AI setup runbook: OpenCode Mobile + opencode on the user's computer

Audience: an AI agent (Claude Code, opencode, Codex, ...) asked to set this up for a person.
Goal: the person's phone controls the opencode agent on their computer, with the fewest human actions.

## What only the human can do (never more than these)

| # | Human action | When it happens |
|---|---|---|
| 1 | Click **Yes** on a Windows permission prompt | only if Node.js or Tailscale has to be installed |
| 2 | Sign in to Tailscale in the browser (Google / Microsoft / GitHub) | only the first time, and only in `tailscale` mode |
| 3 | Install the APK on the phone (allow "install unknown apps" once) | first time |
| 4 | Point the app at the QR code, tap **Connect** | first time |

Everything else is yours. Do not ask the person to open a terminal, edit files or copy passwords.

## Safety rules (hard)

- The server must stay bound to `127.0.0.1` (the script guarantees it). Never use `--hostname 0.0.0.0`.
- Do not change firewall rules, antivirus settings or Tailscale ACLs. Do not use Tailscale Funnel (public internet).
- The pairing link and `%LOCALAPPDATA%\opencode-connect\password` are secrets. Show the link only to the
  person, in the current conversation. Never put it in commits, issues, logs you upload or shared chats.
- Do not stop or restart anything the person did not ask about. `-Stop` only affects what this tool started.
- Ask before using `-Mode lan` (reachable by every device on the Wi-Fi). A hidden launcher with autostart is installed by default (it can only start/stop/report the opencode server, same password, loopback + tailnet only); tell the person, and use `-NoAutostart` if they decline.

## Step 0: detect

Windows (PowerShell 5.1 or 7). macOS/Linux: use `tools/opencode-connect.sh` with the same flags (`--json`, `--doctor`, ...).

```powershell
$u = 'https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1'
& ([scriptblock]::Create((irm $u))) -Doctor -Json
```

Read the JSON on stdout (progress goes to stderr). Useful fields in `doctor`: `node`, `opencode`,
`tailscaleInstalled`, `tailscaleState` (`Running` is good), `tailscaleIp`, `passwordSaved`, `serverHealthy`.
If `serverHealthy` is already `true`, skip to step 3.

## Step 1: set up the computer

```powershell
& ([scriptblock]::Create((irm $u))) -Json -NoOpen
```

It installs Node.js and opencode if missing (winget / npm, silent), installs Tailscale if missing, waits for sign-in,
starts `opencode serve` on `127.0.0.1:4096`, publishes it inside the tailnet and prints one JSON object. It is
idempotent: run it again after any interruption.

Exit codes: `0` ready, `1` failed (`message` says why), `2` a human step is needed (`needs`).

| `needs` | What to do |
|---|---|
| `tailscale_login` | Give the person `authUrl` (open it, sign in). Then run Step 1 again. |
| `install-Node.js` / `install-Tailscale` | winget is missing: ask the person to install it from nodejs.org / tailscale.com, then run again. |

On success the JSON has `ok: true`, `serverUrl` and `pairingLink` (`opencode://connect?url=...&password=...&name=...`).
Outside tunnel mode it also has `pairCode` (6 digits, valid once, for 10 minutes) and `pairAddress`: if the QR code
cannot be scanned, the person taps **Pair with a code** in the app and types the digits (and the address, if asked).

## Step 2: get the app onto the phone

Latest APK: `GET https://api.github.com/repos/jainikdroid-bit/opencode-mobile/releases/latest`, asset `OpenCode-Mobile-<version>.apk`;
verify it against the asset `SHA256SUMS`. Pick the first option that applies:

1. **Phone already visible to adb** (`adb devices` lists it; wireless debugging counts): download, verify, then
   `adb install -r OpenCode-Mobile-<version>.apk`. The person does nothing.
2. **No adb:** tell the person to open `https://github.com/jainikdroid-bit/opencode-mobile/releases/latest` on the phone,
   download the APK and open it (allow installs from the browser when Android asks). Alternatively run Step 1 without
   `-NoOpen`: it opens a page on the computer with a QR code for that download link.

## Step 3: pair

Fewest actions first:

1. **adb available:** `adb shell am start -a android.intent.action.VIEW -d "<pairingLink>" cc.agentlabs.opencode`
   (quote the link). The app shows the server; the person taps **Connect**. One tap.
2. **QR:** run Step 1 without `-NoOpen` (or without `-Json`): a page with the QR code opens on the computer. The person
   opens the app, taps **Scan QR to pair**, points the phone at the screen, taps **Connect**.
3. **No camera access:** give the person the `pairingLink` in chat; in the app: **Add Connection -> Paste pairing link**.

## Step 4: verify

```powershell
& ([scriptblock]::Create((irm $u))) -Doctor -Json     # doctor.serverHealthy must be true
```

Then ask the person to open the app: the Sessions tab shows the computer with a green dot. If their opencode has no
model configured, the model picker will be empty: run `opencode auth login` (or configure a provider) for them.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| App says it cannot connect | Phone and computer must be signed in to the **same** Tailscale account; open the Tailscale app on the phone. |
| `serverHealthy: false` after Step 1 | Port taken or opencode crashed: run `opencode serve` in a terminal to read the error; the script picks a free port 4097+ if 4096 is busy. |
| Pairing link rejected | The password was rotated (`-Rotate`) or the link is incomplete: run Step 1 again and use the new link. |
| Phone camera does nothing on the QR | Normal for some camera apps; use the app's own **Scan QR to pair**. |
| Needs to work without Tailscale at home | `-Mode lan` (ask the person first; binds the Wi-Fi address only, password protected). |

## Optional: a free cloud model

`-FreeModel` / `--free-model` merges a keyless Pollinations provider (`pollinations/openai-fast`) into `~/.config/opencode/opencode.json` and sets it as the default model only when none is set. It changes the person's opencode config and sends prompts to a free third-party service: ask first and say so. `-Uninstall` removes only that provider.

## Optional: tunnel mode (no VPN)

`-Mode tunnel` publishes the server through a free Cloudflare quick tunnel (outbound only; `cloudflared` is downloaded into the state directory, no admin rights). This puts the server on the public internet behind the password: ask the person first, prefer `-Mode tailscale`, and never show or log the pairing link (it contains the password and the private ntfy topic). `-Uninstall` stops the tunnel; delete the state directory to remove `cloudflared` and the topic.

## Optional: phone tools for the agent

`-PhoneTools` / `--phone-tools` starts a mailbox (`tools/phone-bridge.js`, port = server port - 2, tailnet only, same password) and adds an MCP server named `phone` to `~/.config/opencode/opencode.json` (merged, other entries untouched; `-Uninstall` removes only that entry). Ask the person first: it changes their opencode config and lets the agent request phone functions. The phone app still decides: every tool is off until the person switches it on in *Settings*, location/photo/clipboard ask every time, and nothing works while the app is closed. Do not try to bypass those switches.

## Undo

`-Stop` stops the server and removes the Tailscale forward. To remove everything: also delete `%LOCALAPPDATA%\opencode-connect`
and the autostart entry (Windows Startup `opencode-connect.vbs`, macOS LaunchAgent `com.opencode.connect`, Linux systemd user unit `opencode-connect.service` or XDG autostart) — `-Uninstall` removes it.

## Flags (both scripts)

`-Mode tailscale|lan|local|tunnel`, `-Port`, `-Name`, `-HostName` (host shown in the link), `-NoInstall`, `-Json`, `-NoOpen`, `-NoQr`,
`-Rotate`, `-NoAutostart`, `-Uninstall`, `-Status`, `-Doctor`, `-Stop`, `-DryRun`, `-NoGuide`. On macOS/Linux the same flags are `--mode`, `--json`, `--no-guide`, ... (`opencode-connect.sh`; both styles are accepted everywhere). Environment: `OPENCODE_CONNECT_DIR` overrides the state directory. The core is `tools/connect.js` (Node.js); the `.ps1`/`.sh` files only make sure Node exists.
