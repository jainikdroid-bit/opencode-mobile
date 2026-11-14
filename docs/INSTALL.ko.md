# 설치 가이드

**언어:** [English](INSTALL.md) · [Русский](INSTALL.ru.md) · [中文](INSTALL.zh-Hans.md) · [Español](INSTALL.es.md) · [Deutsch](INSTALL.de.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [日本語](INSTALL.ja.md) · 한국어 · [Українська](INSTALL.uk.md) · [Türkçe](INSTALL.tr.md)

AgentLink은 **내 컴퓨터**에서 실행되는 코딩 에이전트를 조작하는 Android 앱입니다. 설정은 약 2분, 3단계면 끝납니다.
저희 클라우드 서비스를 거치지 않습니다. 휴대폰이 비공개 연결로 내 컴퓨터와 직접 통신합니다.

## 준비물

- **Android 휴대폰** (Android 7 이상).
- Windows 10/11, macOS 또는 Linux가 설치된 **컴퓨터**. 전원이 켜져 있고 인터넷에 연결되어 있어야 합니다.
- 무료 **Tailscale** 계정 (Google, Microsoft 또는 GitHub로 로그인). 휴대폰과 컴퓨터를 잇는 비공개 통로입니다.
  원하지 않으면 [다른 연결 방법](#다른-연결-방법)을 보세요.

## 1단계. 컴퓨터에서: 명령어 하나 붙여넣기

**Windows.** **PowerShell**을 열고(시작 메뉴에서 `PowerShell` 입력) 다음을 붙여넣습니다.

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS 또는 Linux.** **터미널**을 열고 다음을 붙여넣습니다.

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

스크립트는 작업하면서 각 단계를 설명합니다.

1. 없는 것을 설치합니다(Node.js, opencode). Windows가 권한을 물으면 **예**를 누르세요.
2. **Tailscale**을 설치하고 로그인 페이지를 엽니다. Google, Microsoft 또는 GitHub 중 하나를 고르세요. 필요한 계정은 이것뿐입니다.
3. 서버를 시작하고 **QR 코드 두 개**(앱용, 페어링용)가 있는 페이지를 엽니다.

이 명령은 언제든 안전하게 다시 실행할 수 있습니다. 중복 설치하지 않고 복구합니다.

## 2단계. 휴대폰에서: 앱 설치

1. **첫 번째** QR 코드를 스캔하거나 [릴리스 페이지](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)를 열어
   `OpenCode-Mobile-<버전>.apk`를 내려받아 실행하세요. Android가 브라우저에서의 설치 허용을 한 번 묻습니다. 허용하세요.
2. Google Play에서 **Tailscale**을 설치하고 컴퓨터와 **같은 계정**으로 로그인하세요.

## 3단계. 휴대폰에서: 연결

앱을 열고 **QR 스캔하여 페어링**을 누른 다음, 카메라를 **두 번째** QR 코드에 향하고 **연결**을 누르세요. 끝입니다.

처음 실행하면 앱이 짧은 설정 가이드를 보여 줍니다. **가이드 건너뛰기**를 누르면 다시 나타나지 않습니다.

## 설정 후

- **평소 사용:** 앱만 열면 됩니다. 작은 숨은 도우미(*런처*)가 컴퓨터와 함께 시작해 서버를 띄웁니다.
  서버가 꺼져 있으면 앱에 **시작하기** 버튼이 나타납니다. 컴퓨터는 켜져 있고 온라인이어야 합니다. 절전 중인 컴퓨터는 깨울 수 없습니다.
- **확인 또는 복구:** 같은 명령을 다시 실행하거나 `-Doctor`(확인만) / `-Stop`(서버 중지)을 붙이세요.
- **모두 제거:** `-Uninstall`을 붙이세요. 설정은 삭제할 수 있는 폴더에 남습니다(스크립트가 위치를 알려 줍니다).

옵션은 명령 뒤에 씁니다. Windows에서는 `-Doctor`처럼, macOS/Linux에서는 `sh -s --` 뒤에 `--doctor`처럼 씁니다.
`curl -fsSL <url> | sh -s -- --doctor`

## 다른 연결 방법

| 상황 | 붙일 옵션 | 동작 |
|---|---|---|
| 휴대폰과 컴퓨터가 같은 Wi-Fi이고 Tailscale을 쓰기 싫음 | `-Mode lan` (`--mode lan`) | 집 네트워크에서만 접속 가능, 계정 불필요 |
| 휴대폰에 VPN이 없음 | `-Mode tunnel` (`--mode tunnel`) | 무료 Cloudflare 터널, 아래 주의 참고 |
| 설명 생략 | `-NoGuide` (`--no-guide`) | 조용한 출력 |
| 로그인 시 도우미를 시작하지 않음 | `-NoAutostart` (`--no-autostart`) | 명령을 실행할 때만 서버가 시작됨 |

### 터널 모드, 솔직하게

`-Mode tunnel`은 무료 `cloudflared` 클라이언트를 내려받아 외부로만 나가는 Cloudflare 터널을 엽니다(계정 불필요, 열린 포트 없음).
주소는 **공개 인터넷**에 있으며, 긴 무작위 비밀번호와 추측할 수 없는 주소로 보호됩니다. 같은 클라이언트가 10번 틀리면 1분간 차단됩니다.
터널이 다시 시작되면 주소가 바뀌며, 앱이 새 주소를 스스로 알아냅니다. 페어링 링크를 얻은 사람은 누구나 내 에이전트를 쓸 수 있으니
절대 공유하지 마세요. 기본으로는 계속 Tailscale을 권장합니다.

## 편리한 기능

- **OpenCode로 공유:** 아무 앱에서나 공유를 누르고 OpenCode를 선택하면 텍스트, 링크, 이미지, 작은 텍스트 파일이 세션에 들어갑니다.
- **음성 대화:** 마이크 옆 헤드셋을 눌러 말하고, 답을 듣고, 다시 듣기 시작합니다.
- **빠른 권한 허용:** 에이전트가 무언가 실행을 요청하면 배너(및 알림)에 거부 / 항상 / 허용이 나타납니다.
- **세션 검색과 고정:** 세션 화면의 검색창. 세션을 길게 누르면 고정됩니다.
- **에이전트용 휴대폰 도구(선택, 기본 꺼짐):** 설치 프로그램을 `-PhoneTools`(`--phone-tools`)로 실행한 뒤 앱에서
  *설정 → AI 에이전트용 휴대폰 도구*를 켜세요. 에이전트가 알림 표시, 음성 읽기, 클립보드 사용, 위치 확인, 사진 촬영 요청을 할 수 있습니다.
  민감한 작업은 매번 묻고, 앱이 열려 있을 때만 작동합니다.

## AI 에이전트에게 맡기기

에이전트(Claude Code, opencode, Codex 등)에게 이렇게 말하세요.

> AgentLink을 설정해 줘. https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md 를 따라 줘

여러분은 Windows 창에서 **예**를 누르고, Tailscale에 한 번 로그인하고, 휴대폰에서 **연결**을 누르기만 하면 됩니다.

## 문제 해결

| 문제 | 해결 방법 |
|---|---|
| 앱이 연결되지 않음 | 휴대폰과 컴퓨터가 **같은** Tailscale 계정을 써야 합니다. 휴대폰에서 Tailscale을 열어 켜져 있는지 확인하세요. |
| 명령을 붙여넣어도 아무것도 열리지 않음 | `-NoOpen`을 붙여 다시 실행하고, 페이지 대신 출력되는 페어링 링크를 사용하세요. |
| "스크립트 실행이 비활성화되어 있습니다" | 명령을 보이는 그대로 붙여넣으세요(스크립트 권한이 필요 없습니다). `.ps1` 파일로 저장하지 마세요. |
| 카메라가 QR 코드를 인식하지 못함 | 앱의 **QR 스캔하여 페어링**을 쓰거나, 출력된 링크를 **연결 추가 → 페어링 링크 붙여넣기**에 복사하세요. |
| 페어링 링크가 거부됨 | 비밀번호가 바뀌었거나(`-Rotate`) 링크가 잘렸습니다. 명령을 다시 실행해 새 링크를 쓰세요. |
| 서버가 꺼져 있고 휴대폰이 시작할 수 없음 | 컴퓨터가 절전 중이거나 오프라인이거나 도우미가 제거되었습니다. 컴퓨터를 켜거나 명령을 다시 실행하세요. |

## 지원 플랫폼

| | 컴퓨터 | 휴대폰 |
|---|---|---|
| Windows 10/11 | 테스트됨 | 해당 없음 |
| Linux | 지원(systemd 또는 XDG 자동 시작), 테스트 제한적 | 해당 없음 |
| macOS | 지원(LaunchAgent), 실제 기기에서는 아직 미테스트 | 해당 없음 |
| Android | 해당 없음 | 테스트됨 |
| iOS | 해당 없음 | 코드는 호환되지만 iOS 빌드는 만들거나 테스트한 적 없음 |
