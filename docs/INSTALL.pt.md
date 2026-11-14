# Guia de instalação

**Idiomas:** [English](INSTALL.md) · [Русский](INSTALL.ru.md) · [中文](INSTALL.zh-Hans.md) · [Español](INSTALL.es.md) · [Deutsch](INSTALL.de.md) · [Français](INSTALL.fr.md) · Português · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [Українська](INSTALL.uk.md) · [Türkçe](INSTALL.tr.md)

O AgentLink é um app Android que controla o agente de programação executado no **seu próprio computador**.
A configuração leva cerca de dois minutos e três passos. Nada passa por um serviço em nuvem nosso: o celular conversa com o
seu computador por uma conexão privada.

## O que você precisa

- Um **celular Android** (Android 7 ou mais recente).
- Um **computador** com Windows 10/11, macOS ou Linux, ligado e com internet.
- Uma conta gratuita do **Tailscale** (login com Google, Microsoft ou GitHub). É o link privado entre o celular e o computador.
  Não quer usar? Veja [outras formas de conectar](#outras-formas-de-conectar).

## Passo 1. No computador: cole um comando

**Windows.** Abra o **PowerShell** (menu Iniciar, digite `PowerShell`) e cole:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS ou Linux.** Abra o **Terminal** e cole:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

O script explica cada passo enquanto trabalha:

1. Instala o que faltar (Node.js, opencode). Se o Windows pedir permissão, clique em **Sim**.
2. Instala o **Tailscale** e abre uma página de login. Escolha Google, Microsoft ou GitHub. Essa é a única conta de que você precisa.
3. Inicia o servidor e abre uma página com **dois códigos QR** (um para o app, outro para o pareamento).

Você pode executar o comando de novo a qualquer momento, sem risco: ele repara em vez de duplicar.

## Passo 2. No celular: instale o app

1. Escaneie o **primeiro** código QR, ou abra a [página de versões](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest),
   baixe `OpenCode-Mobile-<versão>.apk` e abra. O Android pergunta uma vez se permite instalar a partir do navegador: permita.
2. Instale o **Tailscale** pelo Google Play e entre com a **mesma conta** do computador.

## Passo 3. No celular: conecte

Abra o app, toque em **Escanear QR para emparelhar**, aponte a câmera para o **segundo** código QR e toque em **Conectar**. Pronto.

Na primeira vez, o app mostra um guia rápido de configuração; toque em **Pular guia** para dispensá-lo de vez.

## Depois da configuração

- **Uso diário:** basta abrir o app. Um pequeno auxiliar oculto (o *iniciador*) começa junto com o computador e sobe o servidor.
  Se o servidor estiver desligado, o app mostra um botão **Iniciar**. O computador precisa estar ligado e online: nada
  consegue acordar um computador em suspensão.
- **Verificar ou reparar:** execute o mesmo comando de novo, ou acrescente `-Doctor` (só verifica) / `-Stop` (para o servidor).
- **Remover tudo:** acrescente `-Uninstall`. Suas configurações ficam numa pasta que você pode apagar (o script mostra onde).

As opções vão depois do comando. No Windows escreva `-Doctor`; no macOS/Linux, `--doctor` depois de `sh -s --`:
`curl -fsSL <url> | sh -s -- --doctor`.

## Outras formas de conectar

| Situação | Acrescente a opção | O que faz |
|---|---|---|
| Celular e computador no mesmo Wi-Fi, sem Tailscale | `-Mode lan` (`--mode lan`) | Acessível só na sua rede doméstica, sem nenhuma conta |
| Sem VPN no celular | `-Mode tunnel` (`--mode tunnel`) | Túnel gratuito da Cloudflare, veja o aviso abaixo |
| Sem explicações | `-NoGuide` (`--no-guide`) | Saída silenciosa |
| Não iniciar o auxiliar ao entrar no sistema | `-NoAutostart` (`--no-autostart`) | O servidor só inicia quando você executa o comando |

### Modo túnel, com honestidade

`-Mode tunnel` baixa o cliente gratuito `cloudflared` e abre um túnel da Cloudflare somente de saída (sem conta, sem portas
abertas). O endereço fica **na internet pública**, protegido por uma senha longa e aleatória e por um endereço impossível de
adivinhar; após 10 tentativas erradas, um cliente é bloqueado por um minuto. O endereço muda quando o túnel reinicia, e o app
descobre o novo sozinho. Quem obtiver seu link de pareamento pode usar seu agente, então nunca o compartilhe. O Tailscale
continua sendo a opção recomendada.

## Recursos úteis

- **Compartilhar com o OpenCode:** em qualquer app toque em Compartilhar e escolha OpenCode; texto, links, imagens e pequenos arquivos de texto vão para uma sessão.
- **Conversa por voz:** toque no fone de ouvido ao lado do microfone, fale, ouça a resposta, e ele volta a ouvir.
- **Permissões rápidas:** quando o agente pede para executar algo, um banner (e a notificação) oferece Recusar / Sempre / Permitir.
- **Buscar e fixar sessões:** campo de busca na tela de sessões; mantenha uma sessão pressionada para fixá-la.
- **Ferramentas do celular para o agente (opcional, desligado por padrão):** execute o instalador com `-PhoneTools`
  (`--phone-tools`) e ative *Configurações → Ferramentas do celular para o agente de IA*. O agente poderá mostrar notificações,
  falar em voz alta, usar a área de transferência, obter sua localização ou pedir que você tire uma foto. Ações sensíveis
  perguntam sempre, e só funciona com o app aberto.

## Deixe um agente de IA fazer isso

Diga ao seu agente (Claude Code, opencode, Codex, ...):

> Configure o AgentLink para mim. Siga https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md

Você só clica em **Sim** no aviso do Windows, entra uma vez no Tailscale e toca em **Conectar** no celular.

## Solução de problemas

| Problema | Solução |
|---|---|
| O app não conecta | Celular e computador devem usar a **mesma** conta do Tailscale. Abra o Tailscale no celular e confirme que está ligado. |
| Nada abre depois de colar o comando | Execute-o de novo com `-NoOpen` e use o link de pareamento que ele imprime em vez da página. |
| "A execução de scripts está desabilitada" | Cole o comando exatamente como está (ele não precisa de permissão para scripts); não o salve como arquivo `.ps1`. |
| A câmera não reconhece o QR | Use **Escanear QR para emparelhar** dentro do app, ou copie o link impresso em **Adicionar conexão → Colar link de emparelhamento**. |
| Link de pareamento recusado | A senha foi alterada (`-Rotate`) ou o link foi cortado. Execute o comando de novo e use o link novo. |
| O servidor está desligado e o celular não consegue iniciá-lo | O computador está em suspensão ou offline, ou o auxiliar foi removido. Ligue o computador ou execute o comando de novo. |

## Plataformas compatíveis

| | Computador | Celular |
|---|---|---|
| Windows 10/11 | testado | n/d |
| Linux | compatível (systemd ou inicialização automática XDG), pouco testado | n/d |
| macOS | compatível (LaunchAgent), ainda não testado em hardware real | n/d |
| Android | n/d | testado |
| iOS | n/d | o código é compatível, mas nenhuma versão para iOS foi compilada ou testada |
