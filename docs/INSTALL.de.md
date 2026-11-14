# Installationsanleitung

**Sprachen:** [English](INSTALL.md) · [Русский](INSTALL.ru.md) · [中文](INSTALL.zh-Hans.md) · [Español](INSTALL.es.md) · Deutsch · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [Українська](INSTALL.uk.md) · [Türkçe](INSTALL.tr.md)

AgentLink ist eine Android-App, mit der du den Coding-Agenten steuerst, der auf **deinem eigenen Computer** läuft.
Die Einrichtung dauert etwa zwei Minuten und drei Schritte. Nichts läuft über einen Cloud-Dienst von uns: Das Handy spricht
über eine private Verbindung mit deinem Computer.

## Was du brauchst

- Ein **Android-Handy** (Android 7 oder neuer).
- Einen **Computer** mit Windows 10/11, macOS oder Linux, eingeschaltet und online.
- Ein kostenloses **Tailscale**-Konto (Anmeldung mit Google, Microsoft oder GitHub). Es ist die private Verbindung zwischen
  Handy und Computer. Möchtest du es nicht? Siehe [andere Verbindungsarten](#andere-verbindungsarten).

## Schritt 1. Am Computer: einen Befehl einfügen

**Windows.** Öffne **PowerShell** (Startmenü, `PowerShell` eintippen) und füge ein:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS oder Linux.** Öffne das **Terminal** und füge ein:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

Das Skript erklärt jeden Schritt, während es arbeitet:

1. Es installiert, was fehlt (Node.js, opencode). Fragt Windows nach einer Erlaubnis, klicke auf **Ja**.
2. Es installiert **Tailscale** und öffnet eine Anmeldeseite. Wähle Google, Microsoft oder GitHub. Das ist das einzige Konto, das du brauchst.
3. Es startet den Server und öffnet eine Seite mit **zwei QR-Codes** (einer für die App, einer fürs Koppeln).

Du kannst den Befehl jederzeit gefahrlos erneut ausführen: Er repariert, statt doppelt zu installieren.

## Schritt 2. Am Handy: die App installieren

1. Scanne den **ersten** QR-Code oder öffne die [Releases-Seite](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest),
   lade `OpenCode-Mobile-<Version>.apk` herunter und öffne sie. Android fragt einmal, ob Installationen aus deinem Browser erlaubt sind: Erlaube es.
2. Installiere **Tailscale** aus Google Play und melde dich mit **demselben Konto** wie am Computer an.

## Schritt 3. Am Handy: verbinden

Öffne die App, tippe auf **QR scannen zum Koppeln**, richte die Kamera auf den **zweiten** QR-Code und tippe auf **Verbinden**. Fertig.

Beim ersten Start zeigt die App eine kurze Einrichtungsanleitung; tippe auf **Anleitung überspringen**, um sie dauerhaft zu schließen.

## Nach der Einrichtung

- **Im Alltag:** Öffne einfach die App. Ein kleiner versteckter Helfer (der *Launcher*) startet mit deinem Computer und
  fährt den Server hoch. Ist der Server einmal aus, zeigt die App die Schaltfläche **Starten**. Der Computer muss
  eingeschaltet und online sein: Einen schlafenden Computer kann nichts aufwecken.
- **Prüfen oder reparieren:** Führe denselben Befehl erneut aus oder füge `-Doctor` (nur prüfen) bzw. `-Stop` (Server stoppen) hinzu.
- **Alles entfernen:** Füge `-Uninstall` hinzu. Deine Einstellungen bleiben in einem Ordner, den du löschen kannst (das Skript zeigt, wo).

Optionen stehen hinter dem Befehl. Unter Windows schreibst du sie als `-Doctor`; unter macOS/Linux als `--doctor` nach `sh -s --`:
`curl -fsSL <url> | sh -s -- --doctor`.

## Andere Verbindungsarten

| Situation | Option hinzufügen | Wirkung |
|---|---|---|
| Handy und Computer im selben WLAN, kein Tailscale gewünscht | `-Mode lan` (`--mode lan`) | Nur im Heimnetz erreichbar, überhaupt kein Konto |
| Kein VPN auf dem Handy | `-Mode tunnel` (`--mode tunnel`) | Kostenloser Cloudflare-Tunnel, siehe Hinweis unten |
| Ohne Erklärungen | `-NoGuide` (`--no-guide`) | Stille Ausgabe |
| Helfer nicht bei der Anmeldung starten | `-NoAutostart` (`--no-autostart`) | Der Server startet nur, wenn du den Befehl ausführst |

### Tunnel-Modus, ehrlich gesagt

`-Mode tunnel` lädt den kostenlosen Client `cloudflared` herunter und öffnet einen nur ausgehenden Cloudflare-Tunnel (ohne Konto,
ohne offene Ports). Die Adresse liegt **im öffentlichen Internet**, geschützt durch ein langes Zufallspasswort und eine nicht erratbare
Adresse; nach 10 falschen Versuchen eines Clients wird er eine Minute lang gesperrt. Die Adresse ändert sich, wenn der Tunnel neu
startet, und die App erfährt die neue selbst. Wer deinen Kopplungslink bekommt, kann deinen Agenten nutzen – gib ihn also nie weiter.
Tailscale bleibt die empfohlene Standardlösung.

## Praktische Funktionen

- **An OpenCode teilen:** Tippe in jeder App auf Teilen und wähle OpenCode; Text, Links, Bilder und kleine Textdateien landen in einer Sitzung.
- **Sprachunterhaltung:** Tippe auf das Headset neben dem Mikrofon, sprich, höre die Antwort, und es hört wieder zu.
- **Schnelle Freigaben:** Bittet der Agent, etwas auszuführen, bieten ein Banner (und die Benachrichtigung) Ablehnen / Immer / Erlauben.
- **Sitzungen suchen und anheften:** Suchfeld auf dem Sitzungsbildschirm; halte eine Sitzung gedrückt, um sie anzuheften.
- **Handy-Werkzeuge für den Agenten (optional, standardmäßig aus):** Führe das Installationsprogramm mit `-PhoneTools`
  (`--phone-tools`) aus und aktiviere in der App *Einstellungen → Handy-Werkzeuge für den KI-Agenten*. Der Agent kann dann
  Benachrichtigungen anzeigen, sprechen, die Zwischenablage nutzen, deinen Standort abfragen oder dich um ein Foto bitten.
  Sensible Aktionen fragen jedes Mal nach, und es funktioniert nur bei geöffneter App.

## Lass einen KI-Agenten das erledigen

Sag deinem Agenten (Claude Code, opencode, Codex, ...):

> Richte AgentLink für mich ein. Folge https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md

Du klickst nur auf **Ja** bei der Windows-Abfrage, meldest dich einmal bei Tailscale an und tippst am Handy auf **Verbinden**.

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| Die App kann keine Verbindung herstellen | Handy und Computer müssen **dasselbe** Tailscale-Konto nutzen. Öffne Tailscale am Handy und prüfe, ob es eingeschaltet ist. |
| Nach dem Einfügen des Befehls öffnet sich nichts | Führe ihn mit `-NoOpen` erneut aus und nutze den ausgegebenen Kopplungslink statt der Seite. |
| „Die Ausführung von Skripts ist deaktiviert“ | Füge den Befehl genau so ein (er braucht keine Skript-Erlaubnis); speichere ihn nicht als `.ps1`-Datei. |
| Die Kamera erkennt den QR-Code nicht | Nutze **QR scannen zum Koppeln** in der App oder kopiere den ausgegebenen Link unter **Verbindung hinzufügen → Pairing-Link einfügen**. |
| Kopplungslink abgelehnt | Das Passwort wurde geändert (`-Rotate`) oder der Link ist abgeschnitten. Führe den Befehl erneut aus und nutze den neuen Link. |
| Server aus und das Handy kann ihn nicht starten | Der Computer schläft oder ist offline, oder der Helfer wurde entfernt. Schalte den Computer ein oder führe den Befehl erneut aus. |

## Unterstützte Plattformen

| | Computer | Handy |
|---|---|---|
| Windows 10/11 | getestet | – |
| Linux | unterstützt (systemd oder XDG-Autostart), wenig getestet | – |
| macOS | unterstützt (LaunchAgent), noch nicht auf echter Hardware getestet | – |
| Android | – | getestet |
| iOS | – | Code ist kompatibel, aber es wurde noch kein iOS-Build erstellt oder getestet |
