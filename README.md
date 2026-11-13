<p align="center">
  <img src="docs/brand/rig.svg" width="140" alt="RIG, the OpenCode Mobile mascot" />
</p>

<h1 align="center">OpenCode Mobile</h1>

<p align="center">
  <b>Your coding agent, in your pocket.</b><br/>
  A dark, minimal, neon-edged client where you can see the agent think, work and write.
</p>

<p align="center">
  <b>English</b> ·
  <a href="docs/readme/README.ru.md">Русский</a> ·
  <a href="docs/readme/README.zh-Hans.md">中文</a> ·
  <a href="docs/readme/README.es.md">Español</a> ·
  <a href="docs/readme/README.de.md">Deutsch</a> ·
  <a href="docs/readme/README.fr.md">Français</a> ·
  <a href="docs/readme/README.pt.md">Português</a> ·
  <a href="docs/readme/README.ja.md">日本語</a> ·
  <a href="docs/readme/README.ko.md">한국어</a> ·
  <a href="docs/readme/README.uk.md">Українська</a> ·
  <a href="docs/readme/README.tr.md">Türkçe</a>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-22d3ee?labelColor=07080c" />
  <img alt="Platform: Android" src="https://img.shields.io/badge/platform-Android-34f5a5?labelColor=07080c" />
  <img alt="Built with Expo" src="https://img.shields.io/badge/built%20with-Expo-ff3df0?labelColor=07080c" />
  <img alt="UI languages" src="https://img.shields.io/badge/UI-11%20languages-8a93a8?labelColor=07080c" />
</p>

<p align="center">
  <img src="docs/screens/thinking.png" width="19%" alt="RIG writing a reply: animated activity bar with a timer" />
  <img src="docs/screens/models.png" width="19%" alt="Model picker with All / Local / Cloud filter" />
  <img src="docs/screens/connect.png" width="19%" alt="One-scan pairing with your computer" />
  <img src="docs/screens/terminal.png" width="19%" alt="A real shell on your computer" />
  <img src="docs/screens/files.png" width="19%" alt="Project files on your computer" />
</p>

A native Android client for the [opencode](https://github.com/sst/opencode) agent. It talks only to the
server **you** run, over your own network. Nothing goes through a relay or a hosted service.

> Independent community client; not affiliated with the opencode team.

## Highlights

**See what the agent is doing.** A live activity bar names the phase (*Agent is thinking*, *Using bash*,
*Writing the answer*), pulses while it works and keeps a timer. While a reasoning model thinks, its block
breathes, previews the last lines of the thought and collapses to *Thought for 0:12* when done.

**Pair with your computer in one scan.** Run one script on the computer, point the phone camera at the QR
code, confirm, done. The server stays on `127.0.0.1` and is published only inside your Tailscale network.

**Pick the brain, local or cloud.** The model picker has *All / Local / Cloud* chips with counts. Models
served from your own machine (llama.cpp, Ollama, LM Studio, anything on localhost, LAN or Tailscale) are
marked *on your computer*, so switching from a hosted model to your local one is a single tap.

**Connectors on tap.** Settings lists the server's MCP connectors (mail, browser, phone, ...) with on/off
switches. No config editing on the computer.

**Listen and dictate in your language.** Read any reply aloud; voice input follows the app or device
language instead of being English-only.

**Start the server from your phone.** If the server on your computer is off, the app shows a **Start it** button.

**Answer the agent from anywhere.** When the agent asks for approval, a banner with Deny / Always / Allow appears on
any screen, and the notification has the same buttons.

**Talk to it.** Tap the headset: speak, hear the reply, and it listens again.

**Share to OpenCode.** Send text, links, images and small files from any app into a session. Search and pin sessions.

**Give the agent a phone (optional).** Ready-made tools let an agent look at and tap the screen, read the
battery, send notifications, take photos and more, always behind per-action approval. See
[agent phone tools](#agent-phone-tools).

Also: streaming chat, inline diffs, tool-call approval, image attachments, several servers, biometric lock,
credentials in the Android Keystore, dark mode.

**Terminal and files.** Open a real shell on the computer (xterm in a WebView, with Esc / Tab / Ctrl and
arrow keys) or browse the project and read files, straight from the session header.

## Design

Dark only, blue-black with neon cyan and magenta accents, monospace in the chrome. The mascot, **RIG**, is a
cyberpunk site technician: hard hat, glowing visor, antenna. It acts out what the agent is doing.

| State | RIG does |
|---|---|
| thinking | visor eye scans, thought dots rise |
| working | a gear spins beside the head |
| writing | the visor shows typing bars |
| loading | eye scans inside a spinning ring |
| success / error | green smile / red cross |
| offline | flat-line visor, a "?" and a sparking unplugged cable |

No connection? Tap the unplugged RIG to play **RIG RUN**, an endless runner: jump over server racks and live cables; your best score is kept on the phone.

Tokens live in [`src/theme/cyber.ts`](src/theme/cyber.ts); the logo is [`docs/brand/rig.svg`](docs/brand/rig.svg).

## Install in three steps (about two minutes)

Full guide with troubleshooting: **[docs/INSTALL.md](docs/INSTALL.md)**. It is also available in
[Русский](docs/INSTALL.ru.md), [中文](docs/INSTALL.zh-Hans.md), [Español](docs/INSTALL.es.md), [Deutsch](docs/INSTALL.de.md),
[Français](docs/INSTALL.fr.md), [Português](docs/INSTALL.pt.md), [日本語](docs/INSTALL.ja.md), [한국어](docs/INSTALL.ko.md),
[Українська](docs/INSTALL.uk.md) and [Türkçe](docs/INSTALL.tr.md).

**1. Computer: paste one command.** Open PowerShell (Windows) and paste:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

macOS / Linux, in Terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

It installs what is missing (Node.js, opencode, Tailscale), asks you to sign in to Tailscale once, starts the server and
opens a page with two QR codes.

**2. Phone: install.** Scan the first QR code (or open [Releases](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)),
download the APK and open it. Install Tailscale on the phone too and sign in with the same account.

**3. Phone: pair.** Open the app, tap **Scan QR to pair**, point it at the second QR code, tap **Connect**.

Re-running the command is safe (it repairs instead of duplicating). No Tailscale wanted? `-Mode lan` (same Wi-Fi) or
`-Mode tunnel` (free Cloudflare tunnel, see the guide for the trade-off).

### Let an AI agent do it

Tell your AI agent (Claude Code, opencode, Codex, ...): *"Set up OpenCode Mobile for me following
https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md"*. The runbook is written for agents: JSON output,
exit codes, exact commands, safety rules. You only click **Yes** on a Windows prompt, sign in to Tailscale once and tap **Connect** on the phone.

## Agent phone tools

These run on the desktop side and plug into opencode as MCP servers.

| Tool | What it gives the agent |
|---|---|
| [`@mobilenext/mobile-mcp`](https://www.npmjs.com/package/@mobilenext/mobile-mcp) | See the screen, tap, type, launch apps (adb, wireless debugging) |
| [`tools/termux-mcp/phone_mcp.py`](tools/termux-mcp/phone_mcp.py) | Battery, location, notifications, camera, SMS, clipboard, speech, ... via Termux:API, run over SSH |

Keep them behind a dedicated agent and approval, for example:

```jsonc
"permission": { "phone_*": "ask", "mobile_*": "ask" },
"tools": { "phone_*": false, "mobile_*": false },
"agent": { "phone": { "mode": "primary", "tools": { "phone_*": true, "mobile_*": true } } }
```

An opencode plugin can also ping the phone (`termux-notification` over SSH) when a long run finishes or
needs approval, with no cloud service involved.

## Build

Requirements: Node 22+, JDK 17, Android SDK.

```bash
npm ci
npm run typecheck && npm test      # unit tests
cd android && ./gradlew assembleRelease
```

The APKs land in `android/app/build/outputs/apk/release/`: one per CPU architecture (`arm64-v8a` fits almost
every modern phone, `armeabi-v7a` old 32-bit ones, `x86_64` emulators) and a larger universal one. A release build is signed with the debug key unless
you provide your own signing config, so uninstall other builds of the app before installing it.

## Privacy

No analytics, no crash reporting, no accounts. The app talks only to the servers you add. The one other
request is an optional once-a-day check of this project's GitHub releases to tell you about updates.
Credentials live in the Android Keystore.

## License

MIT. See [LICENSE](LICENSE). Based on the MIT-licensed OpenCode Mobile project.
