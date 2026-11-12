<p align="center">
  <img src="../brand/rig.svg" width="140" alt="RIG" />
</p>

<h1 align="center">OpenCode Mobile</h1>

<p align="center">
  <b>Seu agente de programação, no bolso.</b><br/>
  Um cliente escuro e minimalista com detalhes em neon, onde você vê o agente pensar, trabalhar e escrever.
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.zh-Hans.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <b>Português</b> ·
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

Um cliente Android nativo para o agente [opencode](https://github.com/sst/opencode). Ele só fala com o servidor que **você** executa, pela sua própria rede. Nada passa por um relay ou serviço hospedado.

> Cliente comunitário independente; sem ligação com a equipe do opencode.

## Destaques

**Veja o que o agente está fazendo.** Uma barra de atividade ao vivo indica a fase («O agente está pensando», «Usando bash», «Escrevendo a resposta») e mantém um cronômetro; o bloco de raciocínio se recolhe em «Pensou por 0:12».

**Pareie com o computador em um escaneamento.** Execute um script no computador, aponte a câmera para o QR e confirme. O servidor fica em `127.0.0.1` e só é publicado dentro da sua rede Tailscale.

**Escolha o modelo, local ou na nuvem.** Filtro «Todos / Locais / Nuvem»; modelos da sua máquina são marcados e trocar é um toque.

**Inicie o servidor pelo celular.** Se o servidor do computador estiver desligado, o app mostra um botão «Iniciar».

**Responda ao agente de qualquer lugar.** Quando ele pede permissão, um banner aparece em qualquer tela; a notificação tem os mesmos botões.

**Converse com ele.** Toque no fone de ouvido: fale, ouça a resposta, e ele volta a ouvir.

**Compartilhar com o OpenCode, buscar e fixar sessões.**

**Terminal, arquivos, conectores MCP,** diffs, imagens anexas, vários servidores, bloqueio biométrico, credenciais no Android Keystore.

## Instalação em três passos (cerca de dois minutos)

**[Guia completo com solução de problemas](../INSTALL.pt.md)**

**1. Computador: cole um comando.** No PowerShell (Windows):

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

macOS / Linux, no Terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

Ele instala o que faltar (Node.js, opencode, Tailscale), pede que você entre uma vez no Tailscale, inicia o servidor e abre uma página com dois códigos QR.

**2. Celular: instale.** Escaneie o primeiro QR (ou abra [Releases](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)), baixe o APK e abra. Instale também o Tailscale e entre com a mesma conta.

**3. Celular: pareie.** Abra o app, toque em **Escanear QR para emparelhar**, aponte para o segundo QR e toque em **Conectar**.

Executar o comando de novo é seguro (ele repara em vez de duplicar). Sem Tailscale? `-Mode lan` (mesmo Wi-Fi) ou `-Mode tunnel` (túnel gratuito da Cloudflare; as contrapartidas estão no guia).

### Deixe um agente de IA fazer isso

Diga ao seu agente (Claude Code, opencode, Codex, ...): *«Configure o OpenCode Mobile para mim seguindo https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md»*.

O design, as ferramentas do celular para o agente e a compilação a partir do código-fonte estão no [README em inglês](../../README.md).

## Privacidade

Sem análises, sem relatórios de falhas, sem contas. O app só fala com os servidores que você adiciona. A única outra requisição é uma verificação opcional, uma vez por dia, das versões deste projeto no GitHub para avisar de atualizações. As credenciais ficam no Android Keystore.

## Licença

MIT. Veja [LICENSE](../../LICENSE).
