# Guide d'installation

**Langues :** [English](INSTALL.md) · [Русский](INSTALL.ru.md) · [中文](INSTALL.zh-Hans.md) · [Español](INSTALL.es.md) · [Deutsch](INSTALL.de.md) · Français · [Português](INSTALL.pt.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [Українська](INSTALL.uk.md) · [Türkçe](INSTALL.tr.md)

OpenCode Mobile est une application Android qui pilote l'agent de programmation exécuté sur **votre propre ordinateur**.
L'installation prend environ deux minutes et trois étapes. Rien ne passe par un service cloud à nous : le téléphone parle à
votre ordinateur par une connexion privée.

## Ce qu'il vous faut

- Un **téléphone Android** (Android 7 ou plus récent).
- Un **ordinateur** sous Windows 10/11, macOS ou Linux, allumé et connecté à Internet.
- Un compte **Tailscale** gratuit (connexion via Google, Microsoft ou GitHub). C'est le lien privé entre le téléphone et
  l'ordinateur. Vous n'en voulez pas ? Voir [autres façons de se connecter](#autres-façons-de-se-connecter).

## Étape 1. Sur l'ordinateur : collez une commande

**Windows.** Ouvrez **PowerShell** (menu Démarrer, tapez `PowerShell`) et collez :

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS ou Linux.** Ouvrez le **Terminal** et collez :

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

Le script explique chaque étape pendant qu'il travaille :

1. Il installe ce qui manque (Node.js, opencode). Si Windows demande une autorisation, cliquez sur **Oui**.
2. Il installe **Tailscale** et ouvre une page de connexion. Choisissez Google, Microsoft ou GitHub. C'est le seul compte dont vous avez besoin.
3. Il démarre le serveur et ouvre une page avec **deux codes QR** (un pour l'application, un pour le jumelage).

Vous pouvez relancer la commande à tout moment sans risque : elle répare au lieu de dupliquer.

## Étape 2. Sur le téléphone : installez l'application

1. Scannez le **premier** code QR, ou ouvrez la [page des versions](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest),
   téléchargez `OpenCode-Mobile-<version>.apk` et ouvrez-le. Android demande une fois d'autoriser les installations depuis votre navigateur : autorisez.
2. Installez **Tailscale** depuis Google Play et connectez-vous avec le **même compte** que sur l'ordinateur.

## Étape 3. Sur le téléphone : connectez-vous

Ouvrez l'application, touchez **Scanner QR pour associer**, pointez l'appareil photo vers le **second** code QR et touchez **Se connecter**. C'est fait.

Au premier lancement, l'application affiche un court guide de configuration ; touchez **Ignorer le guide** pour le fermer définitivement.

## Après la configuration

- **Au quotidien :** ouvrez simplement l'application. Un petit assistant caché (le *lanceur*) démarre avec votre ordinateur
  et lance le serveur. Si le serveur est éteint, l'application affiche un bouton **Démarrer**. L'ordinateur doit être allumé et
  en ligne : rien ne peut réveiller un ordinateur en veille.
- **Vérifier ou réparer :** relancez la même commande, ou ajoutez `-Doctor` (vérification seule) / `-Stop` (arrête le serveur).
- **Tout supprimer :** ajoutez `-Uninstall`. Vos réglages restent dans un dossier que vous pouvez supprimer (le script indique où).

Les options se placent après la commande. Sous Windows, écrivez-les `-Doctor` ; sous macOS/Linux, `--doctor` après `sh -s --` :
`curl -fsSL <url> | sh -s -- --doctor`.

## Autres façons de se connecter

| Situation | Ajoutez l'option | Effet |
|---|---|---|
| Téléphone et ordinateur sur le même Wi-Fi, sans Tailscale | `-Mode lan` (`--mode lan`) | Accessible uniquement sur votre réseau domestique, aucun compte |
| Pas de VPN sur le téléphone | `-Mode tunnel` (`--mode tunnel`) | Tunnel Cloudflare gratuit, voir l'avertissement ci-dessous |
| Sans explications | `-NoGuide` (`--no-guide`) | Sortie silencieuse |
| Ne pas lancer l'assistant à l'ouverture de session | `-NoAutostart` (`--no-autostart`) | Le serveur ne démarre que lorsque vous lancez la commande |

### Mode tunnel, en toute franchise

`-Mode tunnel` télécharge le client gratuit `cloudflared` et ouvre un tunnel Cloudflare sortant uniquement (sans compte, sans port
ouvert). L'adresse est **sur l'Internet public**, protégée par un long mot de passe aléatoire et une adresse impossible à deviner ;
après 10 essais erronés, un client est bloqué pendant une minute. L'adresse change quand le tunnel redémarre, et l'application
apprend la nouvelle toute seule. Quiconque obtient votre lien de jumelage peut utiliser votre agent : ne le partagez jamais.
Tailscale reste le choix recommandé par défaut.

## Fonctions pratiques

- **Partager vers OpenCode :** dans n'importe quelle application, touchez Partager puis OpenCode ; texte, liens, images et petits fichiers texte arrivent dans une session.
- **Conversation vocale :** touchez le casque à côté du micro, parlez, écoutez la réponse, et il réécoute.
- **Autorisations rapides :** quand l'agent demande à exécuter quelque chose, une bannière (et la notification) propose Refuser / Toujours / Autoriser.
- **Rechercher et épingler des sessions :** champ de recherche sur l'écran des sessions ; appui long sur une session pour l'épingler.
- **Outils du téléphone pour l'agent (facultatif, désactivé par défaut) :** lancez l'installateur avec `-PhoneTools`
  (`--phone-tools`), puis activez *Réglages → Outils du téléphone pour l'agent IA*. L'agent peut alors afficher des notifications,
  parler, utiliser le presse-papiers, obtenir votre position ou vous demander une photo. Les actions sensibles demandent
  confirmation à chaque fois, et cela ne fonctionne que lorsque l'application est ouverte.

## Laissez un agent IA s'en charger

Dites à votre agent (Claude Code, opencode, Codex, ...) :

> Installe OpenCode Mobile pour moi. Suis https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md

Vous cliquez seulement sur **Oui** dans l'invite Windows, vous vous connectez une fois à Tailscale et vous touchez **Se connecter** sur le téléphone.

## Dépannage

| Problème | Solution |
|---|---|
| L'application ne se connecte pas | Le téléphone et l'ordinateur doivent utiliser le **même** compte Tailscale. Ouvrez Tailscale sur le téléphone et vérifiez qu'il est activé. |
| Rien ne s'ouvre après avoir collé la commande | Relancez-la avec `-NoOpen` et utilisez le lien de jumelage qu'elle affiche à la place de la page. |
| « L'exécution de scripts est désactivée » | Collez la commande telle quelle (elle ne demande pas d'autorisation de scripts) ; ne l'enregistrez pas dans un fichier `.ps1`. |
| L'appareil photo ne reconnaît pas le QR | Utilisez **Scanner QR pour associer** dans l'application, ou copiez le lien affiché dans **Ajouter une connexion → Coller le lien d'association**. |
| Lien de jumelage refusé | Le mot de passe a changé (`-Rotate`) ou le lien est tronqué. Relancez la commande et utilisez le nouveau lien. |
| Le serveur est éteint et le téléphone ne peut pas le démarrer | L'ordinateur est en veille ou hors ligne, ou l'assistant a été supprimé. Allumez l'ordinateur ou relancez la commande. |

## Plateformes prises en charge

| | Ordinateur | Téléphone |
|---|---|---|
| Windows 10/11 | testé | s. o. |
| Linux | pris en charge (systemd ou démarrage automatique XDG), peu testé | s. o. |
| macOS | pris en charge (LaunchAgent), pas encore testé sur un vrai Mac | s. o. |
| Android | s. o. | testé |
| iOS | s. o. | le code est compatible, mais aucune version iOS n'a été compilée ni testée |
