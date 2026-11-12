<p align="center">
  <img src="../brand/rig.svg" width="140" alt="RIG" />
</p>

<h1 align="center">OpenCode Mobile</h1>

<p align="center">
  <b>Tu agente de programación, en el bolsillo.</b><br/>
  Un cliente oscuro y minimalista con bordes de neón donde ves al agente pensar, trabajar y escribir.
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.zh-Hans.md">中文</a> ·
  <b>Español</b> ·
  <a href="README.de.md">Deutsch</a> ·
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

Un cliente nativo de Android para el agente [opencode](https://github.com/sst/opencode). Solo habla con el servidor que **tú** ejecutas, por tu propia red. Nada pasa por un relé ni por un servicio alojado.

> Cliente comunitario independiente; sin relación con el equipo de opencode.

## Lo más destacado

**Ve lo que hace el agente.** Una barra de actividad en vivo indica la fase («El agente piensa», «Usando bash», «Escribiendo la respuesta») y lleva un cronómetro; el bloque de razonamiento se pliega en «Pensó 0:12».

**Empareja con tu ordenador con un escaneo.** Ejecuta un script en el ordenador, apunta la cámara al QR y confirma. El servidor se queda en `127.0.0.1` y solo se publica dentro de tu red Tailscale.

**Elige el modelo, local o en la nube.** Filtro «Todos / Locales / Nube»; los modelos de tu máquina van marcados y cambiar es un toque.

**Inicia el servidor desde el móvil.** Si el servidor del ordenador está apagado, la app muestra un botón «Iniciar».

**Responde al agente desde cualquier lugar.** Cuando pide permiso, aparece un banner en cualquier pantalla; la notificación tiene los mismos botones.

**Habla con él.** Toca los auriculares: habla, escucha la respuesta y vuelve a escuchar.

**Compartir con OpenCode, buscar y fijar sesiones.**

**Terminal, archivos, conectores MCP,** diffs, imágenes adjuntas, varios servidores, bloqueo biométrico, credenciales en el Android Keystore.

## Instalación en tres pasos (unos dos minutos)

**[Guía completa con solución de problemas](../INSTALL.es.md)**

**1. Ordenador: pega un comando.** En PowerShell (Windows):

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

macOS / Linux, en el Terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

Instala lo que falte (Node.js, opencode, Tailscale), te pide iniciar sesión una vez en Tailscale, arranca el servidor y abre una página con dos códigos QR.

**2. Móvil: instala.** Escanea el primer QR (o abre [Releases](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)), descarga el APK y ábrelo. Instala también Tailscale e inicia sesión con la misma cuenta.

**3. Móvil: empareja.** Abre la app, toca **Escanear QR para emparejar**, apunta al segundo QR y toca **Conectar**.

Volver a ejecutar el comando es seguro (repara en lugar de duplicar). ¿Sin Tailscale? `-Mode lan` (misma Wi-Fi) o `-Mode tunnel` (túnel gratuito de Cloudflare; las contrapartidas están en la guía).

### Deja que lo haga un agente de IA

Dile a tu agente (Claude Code, opencode, Codex, ...): *«Configura OpenCode Mobile para mí siguiendo https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md»*.

El diseño, las herramientas del móvil para el agente y la compilación desde el código fuente están en el [README en inglés](../../README.md).

## Privacidad

Sin analítica, sin informes de fallos, sin cuentas. La app solo habla con los servidores que añades. La única otra petición es una comprobación opcional, una vez al día, de las versiones de este proyecto en GitHub para avisarte de actualizaciones. Las credenciales viven en el Android Keystore.

## Licencia

MIT. Consulta [LICENSE](../../LICENSE).
