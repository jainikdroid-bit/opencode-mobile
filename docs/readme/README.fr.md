<p align="center">
  <img src="../brand/rig.svg" width="140" alt="RIG" />
</p>

<h1 align="center">OpenCode Mobile</h1>

<p align="center">
  <b>Votre agent de programmation, dans la poche.</b><br/>
  Un client sombre et minimaliste aux accents néon où l'on voit l'agent réfléchir, travailler et écrire.
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.zh-Hans.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <b>Français</b> ·
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

Un client Android natif pour l'agent [opencode](https://github.com/sst/opencode). Il ne parle qu'au serveur que **vous** exécutez, sur votre propre réseau. Rien ne passe par un relais ni un service hébergé.

> Client communautaire indépendant ; sans lien avec l'équipe opencode.

## Points forts

**Voyez ce que fait l'agent.** Une barre d'activité en direct indique la phase (« L'agent réfléchit », « Utilise bash », « Écrit la réponse ») et affiche un chronomètre ; le bloc de raisonnement se replie en « A réfléchi 0:12 ».

**Jumelage en un scan.** Lancez un script sur l'ordinateur, pointez l'appareil photo vers le QR code, confirmez. Le serveur reste sur `127.0.0.1` et n'est publié que dans votre réseau Tailscale.

**Choisissez le modèle, local ou cloud.** Filtre « Tous / Locaux / Cloud » ; les modèles de votre machine sont signalés, changer se fait d'un geste.

**Démarrez le serveur depuis le téléphone.** Si le serveur de l'ordinateur est éteint, l'application affiche un bouton « Démarrer ».

**Répondez à l'agent de n'importe où.** Quand il demande une autorisation, une bannière apparaît sur tous les écrans ; la notification a les mêmes boutons.

**Parlez-lui.** Touchez le casque : parlez, écoutez la réponse, et il réécoute.

**Partager vers OpenCode, recherche et épinglage de sessions.**

**Terminal, fichiers, connecteurs MCP,** diffs, images jointes, plusieurs serveurs, verrouillage biométrique, identifiants dans l'Android Keystore.

## Installation en trois étapes (environ deux minutes)

**[Guide complet avec dépannage](../INSTALL.fr.md)**

**1. Ordinateur : collez une commande.** Dans PowerShell (Windows) :

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

macOS / Linux, dans le Terminal :

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

Elle installe ce qui manque (Node.js, opencode, Tailscale), vous demande de vous connecter une fois à Tailscale, démarre le serveur et ouvre une page avec deux codes QR.

**2. Téléphone : installez.** Scannez le premier QR code (ou ouvrez [Releases](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)), téléchargez l'APK et ouvrez-le. Installez aussi Tailscale et connectez-vous avec le même compte.

**3. Téléphone : jumelez.** Ouvrez l'application, touchez **Scanner QR pour associer**, pointez vers le second QR code, touchez **Se connecter**.

Relancer la commande est sans risque (elle répare au lieu de dupliquer). Pas de Tailscale ? `-Mode lan` (même Wi-Fi) ou `-Mode tunnel` (tunnel Cloudflare gratuit ; les compromis sont dans le guide).

### Laissez un agent IA s'en charger

Dites à votre agent (Claude Code, opencode, Codex, ...) : *« Installe OpenCode Mobile pour moi en suivant https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md »*.

La conception, les outils du téléphone pour l'agent et la compilation depuis les sources sont décrits dans le [README en anglais](../../README.md).

## Confidentialité

Pas d'analytique, pas de rapports de plantage, pas de comptes. L'application ne parle qu'aux serveurs que vous ajoutez. La seule autre requête est une vérification facultative, une fois par jour, des versions GitHub de ce projet pour vous signaler les mises à jour. Les identifiants sont dans l'Android Keystore.

## Licence

MIT. Voir [LICENSE](../../LICENSE).
