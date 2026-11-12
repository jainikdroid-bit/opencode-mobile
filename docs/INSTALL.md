# Install in three steps

Русская версия: [INSTALL.ru.md](INSTALL.ru.md)

You need an Android phone, a computer, and about two minutes. Nothing is sent to any cloud service: your phone talks to
your own computer over a private connection.

## 1. On the computer: paste one command

**Windows:** open **PowerShell** (Start menu, type "PowerShell") and paste:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS / Linux:** open **Terminal** and paste:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

What happens (the script explains each step as it goes):

1. It installs what is missing: Node.js and opencode. If Windows asks for permission, click **Yes**.
2. It installs **Tailscale** (the private link) and opens a sign-in page: pick Google, Microsoft or GitHub. This is the only account you ever need.
3. It starts the server and opens a page with **two QR codes**.

Want to skip the explanations? Add `-NoGuide` (Windows) or `--no-guide` (macOS/Linux).
No Tailscale account wanted and the phone is on the same Wi-Fi? Add `-Mode lan` (or `--mode lan`).

## 2. On the phone: install the app

1. Scan the **first** QR code (or open the [Releases page](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)),
   download `OpenCode-Mobile-<version>.apk` and open it. Android asks once to allow installs from your browser: allow it.
2. Install **Tailscale** from Google Play and sign in with the **same account** as on the computer
   (skip this in LAN mode).

## 3. On the phone: connect

Open the app, tap **Scan QR to pair**, point the camera at the **second** QR code, tap **Connect**. Done.

The first time you open the app it also shows a short setup guide. Tap **Skip guide** any time; it will not come back
(you can reopen it from the empty Sessions screen).

## Afterwards

- Next time just open the app. If the computer restarted, run the command from step 1 again (it repairs, never duplicates),
  or add `-Autostart` once so the server starts when you sign in.
- Check everything: `... -Doctor`. Stop the server: `... -Stop`.
- Phone camera ignores the QR? Use the app's own **Scan QR to pair**, or copy the link the script prints into
  **Add Connection, Paste pairing link**.

## Let an AI agent do it

Tell your agent (Claude Code, opencode, Codex, ...):

> Set up OpenCode Mobile for me. Follow https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md

The runbook has exact commands, JSON output and safety rules. You only click **Yes** on the Windows prompt, sign in to
Tailscale once and tap **Connect** on the phone.

## Troubleshooting

| Problem | Fix |
|---|---|
| App cannot connect | Phone and computer must use the **same** Tailscale account; open the Tailscale app on the phone and check it is on. |
| Nothing opens after pasting the command | Run it again; add `-NoOpen` and use the link it prints instead of the page. |
| "Running scripts is disabled" | Use the command above as is (it does not need script permission); do not save it as a `.ps1` file. |
| Pairing link rejected | The password was changed (`-Rotate`) or the link was cut off: run the command again and use the new link. |
