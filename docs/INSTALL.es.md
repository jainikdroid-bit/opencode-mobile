# Guía de instalación

**Idiomas:** [English](INSTALL.md) · [Русский](INSTALL.ru.md) · [中文](INSTALL.zh-Hans.md) · Español · [Deutsch](INSTALL.de.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [Українська](INSTALL.uk.md) · [Türkçe](INSTALL.tr.md)

AgentLink es una app de Android que controla el agente de programación que se ejecuta en **tu propio ordenador**.
La configuración lleva unos dos minutos y tres pasos. Nada pasa por un servicio en la nube nuestro: el móvil habla con tu
ordenador mediante una conexión privada.

## Qué necesitas

- Un **móvil Android** (Android 7 o superior).
- Un **ordenador** con Windows 10/11, macOS o Linux, encendido y con internet.
- Una cuenta gratuita de **Tailscale** (inicio de sesión con Google, Microsoft o GitHub). Es el enlace privado entre el móvil
  y el ordenador. ¿No la quieres? Mira [otras formas de conectar](#otras-formas-de-conectar).

## Paso 1. En el ordenador: pega un comando

**Windows.** Abre **PowerShell** (menú Inicio, escribe `PowerShell`) y pega:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS o Linux.** Abre el **Terminal** y pega:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

El script explica cada paso mientras trabaja:

1. Instala lo que falte (Node.js, opencode). Si Windows pide permiso, pulsa **Sí**.
2. Instala **Tailscale** y abre una página de inicio de sesión. Elige Google, Microsoft o GitHub. Es la única cuenta que necesitas.
3. Arranca el servidor y abre una página con **dos códigos QR** (uno para la app y otro para emparejar).

Puedes volver a ejecutar el comando cuando quieras sin riesgo: repara en lugar de duplicar.

## Paso 2. En el móvil: instala la app

1. Escanea el **primer** código QR, o abre la [página de versiones](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest),
   descarga `OpenCode-Mobile-<versión>.apk` y ábrelo. Android te pedirá una vez permiso para instalar desde el navegador: permítelo.
2. Instala **Tailscale** desde Google Play e inicia sesión con la **misma cuenta** que en el ordenador.

## Paso 3. En el móvil: conéctate

Abre la app, pulsa **Escanear QR para emparejar**, apunta la cámara al **segundo** código QR y pulsa **Conectar**. Listo.

La primera vez, la app muestra una breve guía de configuración; pulsa **Omitir guía** para descartarla definitivamente.

## Después de configurar

- **Uso diario:** abre la app. Un pequeño ayudante oculto (el *lanzador*) arranca con tu ordenador y levanta el servidor.
  Si el servidor está apagado, la app muestra un botón **Iniciarlo**. El ordenador debe estar encendido y con internet:
  nada puede despertar un ordenador en suspensión.
- **Comprobar o reparar:** ejecuta de nuevo el mismo comando, o añade `-Doctor` (solo comprueba) / `-Stop` (detiene el servidor).
- **Quitarlo todo:** añade `-Uninstall`. Tus ajustes quedan en una carpeta que puedes borrar (el script indica dónde).

Las opciones van después del comando. En Windows se escriben `-Doctor`; en macOS/Linux, `--doctor` tras `sh -s --`:
`curl -fsSL <url> | sh -s -- --doctor`.

## Otras formas de conectar

| Situación | Añade esta opción | Qué hace |
|---|---|---|
| Móvil y ordenador en la misma Wi-Fi, sin Tailscale | `-Mode lan` (`--mode lan`) | Accesible solo en tu red doméstica, sin cuentas |
| Sin VPN en el móvil | `-Mode tunnel` (`--mode tunnel`) | Túnel gratuito de Cloudflare, mira el aviso de abajo |
| Sin explicaciones | `-NoGuide` (`--no-guide`) | Salida silenciosa |
| No iniciar el ayudante al iniciar sesión | `-NoAutostart` (`--no-autostart`) | El servidor solo arranca cuando ejecutas el comando |

### Modo túnel, con sinceridad

`-Mode tunnel` descarga el cliente gratuito `cloudflared` y abre un túnel de Cloudflare solo de salida (sin cuenta, sin puertos
abiertos). La dirección está **en internet público**, protegida por una contraseña larga y aleatoria y una dirección imposible de
adivinar; tras 10 intentos fallidos de un mismo cliente se le bloquea un minuto. La dirección cambia cuando se reinicia el túnel
y la app averigua la nueva por sí sola. Cualquiera que obtenga tu enlace de emparejamiento podrá usar tu agente, así que nunca
lo compartas. Tailscale sigue siendo la opción recomendada.

## Funciones útiles

- **Compartir con OpenCode:** en cualquier app pulsa Compartir y elige OpenCode; texto, enlaces, imágenes y archivos de texto pequeños llegan a una sesión.
- **Conversación por voz:** pulsa los auriculares junto al micrófono, habla, escucha la respuesta y vuelve a escuchar.
- **Permisos rápidos:** cuando el agente pide ejecutar algo, un banner (y la notificación) ofrece Rechazar / Siempre / Permitir.
- **Buscar y fijar sesiones:** cuadro de búsqueda en la pantalla de sesiones; mantén pulsada una sesión para fijarla.
- **Herramientas del móvil para el agente (opcional, desactivado por defecto):** ejecuta el instalador con `-PhoneTools`
  (`--phone-tools`) y activa *Ajustes → Herramientas del móvil para el agente de IA*. El agente podrá mostrar notificaciones,
  hablar, usar el portapapeles, obtener tu ubicación o pedirte una foto. Las acciones sensibles preguntan siempre y solo
  funcionan con la app abierta.

## Deja que un agente de IA lo haga

Dile a tu agente (Claude Code, opencode, Codex, ...):

> Configura AgentLink para mí. Sigue https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md

Solo pulsas **Sí** en el aviso de Windows, inicias sesión una vez en Tailscale y pulsas **Conectar** en el móvil.

## Solución de problemas

| Problema | Solución |
|---|---|
| La app no se conecta | El móvil y el ordenador deben usar la **misma** cuenta de Tailscale. Abre Tailscale en el móvil y comprueba que esté activado. |
| No se abre nada tras pegar el comando | Ejecútalo con `-NoOpen` y usa el enlace de emparejamiento que imprime en lugar de la página. |
| «La ejecución de scripts está deshabilitada» | Pega el comando tal cual (no necesita permiso para scripts); no lo guardes como archivo `.ps1`. |
| La cámara no reconoce el QR | Usa **Escanear QR para emparejar** dentro de la app, o copia el enlace impreso en **Añadir conexión → Pegar enlace de emparejamiento**. |
| Enlace de emparejamiento rechazado | Se cambió la contraseña (`-Rotate`) o el enlace está cortado. Ejecuta de nuevo el comando y usa el enlace nuevo. |
| El servidor está apagado y el móvil no puede iniciarlo | El ordenador está en suspensión o sin conexión, o se quitó el ayudante. Enciende el ordenador o ejecuta el comando otra vez. |

## Plataformas compatibles

| | Ordenador | Móvil |
|---|---|---|
| Windows 10/11 | probado | n/d |
| Linux | compatible (systemd o inicio automático XDG), poco probado | n/d |
| macOS | compatible (LaunchAgent), aún no probado en un equipo real | n/d |
| Android | n/d | probado |
| iOS | n/d | el código es compatible, pero no se ha compilado ni probado una versión para iOS |
