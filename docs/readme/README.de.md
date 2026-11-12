<p align="center">
  <img src="../brand/rig.svg" width="140" alt="RIG" />
</p>

<h1 align="center">OpenCode Mobile</h1>

<p align="center">
  <b>Dein Coding-Agent in der Hosentasche.</b><br/>
  Ein dunkler, minimalistischer Client mit Neonkanten, in dem du den Agenten denken, arbeiten und schreiben siehst.
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.zh-Hans.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <b>Deutsch</b> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.uk.md">Українська</a> ·
  <a href="README.tr.md">Türkçe</a>
</p>

<p align="center">
  <img src="../screens/thinking.png" width="19%" alt="" />
  <img src="../screens/models.png" width="19%" alt="" />
  <img src="../screens/connect.png" width="19%" alt="" />
  <img src="../screens/terminal.png" width="19%" alt="" />
  <img src="../screens/files.png" width="19%" alt="" />
</p>

Ein nativer Android-Client für den [opencode](https://github.com/sst/opencode)-Agenten. Er spricht nur mit dem Server, den **du** betreibst, über dein eigenes Netzwerk. Nichts läuft über ein Relay oder einen gehosteten Dienst.

> Unabhängiger Community-Client; nicht mit dem opencode-Team verbunden.

## Highlights

**Sieh, was der Agent tut.** Eine Live-Aktivitätsleiste nennt die Phase („Agent denkt nach“, „Nutzt bash“, „Schreibt die Antwort“) und zählt mit; der Denkblock klappt zu „Gedacht 0:12“ zusammen.

**Mit einem Scan koppeln.** Führe ein Skript auf dem Computer aus, richte die Handykamera auf den QR-Code, bestätige. Der Server bleibt auf `127.0.0.1` und wird nur in deinem Tailscale-Netz veröffentlicht.

**Modell wählen, lokal oder in der Cloud.** Filter „Alle / Lokal / Cloud“; Modelle von deinem Rechner sind markiert, der Wechsel ist ein Tipp.

**Server vom Handy starten.** Ist der Server auf dem Computer aus, zeigt die App die Schaltfläche „Starten“.

**Dem Agenten von überall antworten.** Bittet er um Freigabe, erscheint ein Banner auf jedem Bildschirm; die Benachrichtigung hat dieselben Schaltflächen.

**Sprich mit ihm.** Tippe auf das Headset: sprechen, Antwort hören, und es hört wieder zu.

**Teilen an OpenCode, Sitzungen suchen und anheften.**

**Terminal, Dateien, MCP-Konnektoren,** Diffs, Bildanhänge, mehrere Server, biometrische Sperre, Zugangsdaten im Android Keystore.

## Installation in drei Schritten (etwa zwei Minuten)

**[Vollständige Anleitung mit Fehlerbehebung](../INSTALL.de.md)**

**1. Computer: einen Befehl einfügen.** In PowerShell (Windows):

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

macOS / Linux, im Terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

Er installiert, was fehlt (Node.js, opencode, Tailscale), bittet dich einmal um die Tailscale-Anmeldung, startet den Server und öffnet eine Seite mit zwei QR-Codes.

**2. Handy: installieren.** Scanne den ersten QR-Code (oder öffne [Releases](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)), lade die APK herunter und öffne sie. Installiere auch Tailscale und melde dich mit demselben Konto an.

**3. Handy: koppeln.** Öffne die App, tippe auf **QR scannen zum Koppeln**, richte sie auf den zweiten QR-Code, tippe auf **Verbinden**.

Den Befehl erneut auszuführen ist sicher (er repariert statt zu duplizieren). Kein Tailscale gewünscht? `-Mode lan` (selbes WLAN) oder `-Mode tunnel` (kostenloser Cloudflare-Tunnel; die Abwägung steht in der Anleitung).

### Lass einen KI-Agenten das erledigen

Sag deinem Agenten (Claude Code, opencode, Codex, ...): *„Richte OpenCode Mobile für mich ein, folge https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md“*.

Design, Handy-Werkzeuge für den Agenten und das Bauen aus dem Quellcode stehen im [englischen README](../../README.md).

## Datenschutz

Keine Analyse, keine Absturzberichte, keine Konten. Die App spricht nur mit den Servern, die du hinzufügst. Die einzige weitere Anfrage ist eine optionale tägliche Prüfung der GitHub-Releases dieses Projekts, um dich über Updates zu informieren. Zugangsdaten liegen im Android Keystore.

## Lizenz

MIT. Siehe [LICENSE](../../LICENSE).
