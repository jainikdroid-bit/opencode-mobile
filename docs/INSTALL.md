# Install guide

**Languages:** English · [Русский](INSTALL.ru.md) · [中文](INSTALL.zh-Hans.md) · [Español](INSTALL.es.md) · [Deutsch](INSTALL.de.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [Українська](INSTALL.uk.md) · [Türkçe](INSTALL.tr.md)

OpenCode Mobile is an Android app that controls the coding agent running on **your own computer**. Setup takes about
two minutes and three steps. Nothing goes through a cloud service of ours: the phone talks to your computer over a
private connection.

## What you need

- An **Android phone** (Android 7 or newer).
- A **computer** with Windows 10/11, macOS or Linux, switched on and online.
- A free **Tailscale** account (Google, Microsoft or GitHub sign-in). It is the private link between phone and computer.
  Do not want it? See [other ways to connect](#other-ways-to-connect).

## Step 1. On the computer: paste one command

**Windows.** Open **PowerShell** (Start menu, type `PowerShell`) and paste:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS or Linux.** Open **Terminal** and paste:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

The script explains every step while it works:

1. It installs what is missing (Node.js, opencode). If Windows asks for permission, click **Yes**.
2. It installs **Tailscale** and opens a sign-in page. Pick Google, Microsoft or GitHub. This is the only account you need.
3. It starts the server and opens a page with **two QR codes** (one for the app, one for pairing).

It is safe to run the command again at any time: it repairs instead of duplicating.

## Step 2. On the phone: install the app

1. Scan the **first** QR code, or open the [Releases page](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest),
   download `OpenCode-Mobile-<version>.apk` and open it. Android asks once to allow installs from your browser: allow it.
2. Install **Tailscale** from Google Play and sign in with the **same account** as on the computer.

## Step 3. On the phone: connect

Open the app, tap **Scan QR to pair**, point the camera at the **second** QR code and tap **Connect**. Done.

**Cannot scan?** Tap **Pair with a code** instead. The setup command shows 6 digits next to the QR code: the app finds
the computer by itself, you type the digits. The code works once, for 10 minutes; run the command again for a new one.

**At home, no Tailscale or VPN needed.** The computer also answers on its home-network address, and the app goes there
directly whenever the phone is on the same Wi-Fi (it first checks that it is really your computer). Away from home it uses
Tailscale as before. If Windows asks whether Node.js may use the network, allow private networks. Turn it off: `--no-lan`.

The app shows a short setup guide the first time; tap **Skip guide** to dismiss it for good.

## After setup

- **Everyday use:** just open the app. A small hidden helper (the *launcher*) starts with your computer and brings the
  server up. If the server is ever off, the app shows a **Start it** button. The computer must be on and online: nothing can
  wake a sleeping computer.
- **Check or repair:** run the same command again, or add `-Doctor` (checks only) / `-Stop` (stops the server).
- **Remove everything:** add `-Uninstall`. Your settings stay in a folder you can delete (the script prints where).

Flags go after the command. On Windows write them as `-Doctor`; on macOS/Linux as `--doctor` and pass them after `sh -s --`:
`curl -fsSL <url> | sh -s -- --doctor`.

## Other ways to connect

| Situation | Add this flag | What it does |
|---|---|---|
| Phone and computer on the same Wi-Fi, no Tailscale wanted | `-Mode lan` (`--mode lan`) | Reachable on your home network only, no account at all |
| No VPN on the phone | `-Mode tunnel` (`--mode tunnel`) | Free Cloudflare tunnel, see the warning below |
| No model configured yet, want to try it | `-FreeModel` (`--free-model`) | Adds a free cloud model that needs no account or key (Pollinations, GPT-OSS 20B). Prompts go to that free service, so not for private code. Your default model is not changed |
| Skip the explanations | `-NoGuide` (`--no-guide`) | Quiet output |
| Do not start the helper at sign-in | `-NoAutostart` (`--no-autostart`) | Server starts only when you run the command |

### Tunnel mode, honestly

`-Mode tunnel` downloads the free `cloudflared` client and opens an outbound-only Cloudflare tunnel (no account, no open
ports). The address is **on the public internet**, protected by a long random password and an unguessable address; wrong
guesses from one client are blocked for a minute after 10 tries. The address changes when the tunnel restarts, and the
app learns the new one by itself. Anyone who gets your pairing link can use your agent, so never share it. Tailscale
stays the recommended default.

## Handy features

- **Share to OpenCode:** in any app tap Share and pick OpenCode; text, links, images and small text files land in a session.
- **Voice conversation:** tap the headset next to the microphone, speak, hear the answer, and it listens again.
- **Quick permissions:** when the agent asks to run something, a banner (and the notification) has Deny / Always / Allow.
- **Search and pin sessions:** the search box on the Sessions screen; long-press a session to pin it.
- **Phone tools for the agent (optional, off by default):** run the installer with `-PhoneTools` (`--phone-tools`), then turn
  on *Settings → Phone tools for the AI agent*. The agent can show notifications, speak, use the clipboard, get your
  location or ask you to take a photo. Sensitive actions ask every time and it works only while the app is open.

## Let an AI agent do it

Tell your agent (Claude Code, opencode, Codex, ...):

> Set up OpenCode Mobile for me. Follow https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md

You only click **Yes** on a Windows prompt, sign in to Tailscale once and tap **Connect** on the phone.

## Troubleshooting

| Problem | Fix |
|---|---|
| The app cannot connect | Phone and computer must use the **same** Tailscale account. Open Tailscale on the phone and check it is on. |
| Nothing opens after pasting the command | Run it again with `-NoOpen` and use the pairing link it prints instead of the page. |
| "Running scripts is disabled" | Paste the command exactly as shown (it needs no script permission); do not save it as a `.ps1` file. |
| The camera ignores the QR code | Use the app's own **Scan QR to pair**, or copy the printed link into **Add Connection → Paste pairing link**. |
| Pairing link rejected | The password was changed (`-Rotate`) or the link was cut off. Run the command again and use the new link. |
| The server is off and the phone cannot start it | The computer is asleep or offline, or the helper was removed. Start the computer, or run the command again. |

## Supported platforms

| | Computer | Phone |
|---|---|---|
| Windows 10/11 | tested | n/a |
| Linux | supported (systemd or XDG autostart), lightly tested | n/a |
| macOS | supported (LaunchAgent), not yet tested on real hardware | n/a |
| Android | n/a | tested |
| iOS | n/a | code is compatible, but no iOS build has been made or tested |
