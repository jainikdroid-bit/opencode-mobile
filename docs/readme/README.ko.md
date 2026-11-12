<p align="center">
  <img src="../brand/rig.svg" width="140" alt="RIG" />
</p>

<h1 align="center">OpenCode Mobile</h1>

<p align="center">
  <b>주머니 속의 코딩 에이전트.</b><br/>
  에이전트가 생각하고, 일하고, 쓰는 모습을 볼 수 있는 어둡고 미니멀한 네온 테두리의 클라이언트.
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.zh-Hans.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ja.md">日本語</a> ·
  <b>한국어</b> ·
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

[opencode](https://github.com/sst/opencode) 에이전트를 위한 네이티브 Android 클라이언트입니다. **내가** 실행하는 서버와만, 내 네트워크로 통신합니다. 중계 서버나 호스팅 서비스를 거치지 않습니다.

> 독립적인 커뮤니티 클라이언트이며 opencode 팀과 관련이 없습니다.

## 주요 기능

**에이전트가 하는 일이 보입니다.** 실시간 활동 표시줄이 단계(“에이전트가 생각 중”, “bash 사용 중”, “답변 작성 중”)를 알려 주고 타이머를 보여 주며, 추론 블록은 “0:12 동안 생각함”으로 접힙니다.

**한 번의 스캔으로 페어링.** 컴퓨터에서 스크립트 하나를 실행하고 QR 코드에 카메라를 향해 확인하면 끝. 서버는 `127.0.0.1`에 머물며 Tailscale 네트워크 안에서만 공개됩니다.

**로컬이든 클라우드든 모델 선택.** “전체 / 로컬 / 클라우드” 필터. 내 컴퓨터의 모델에는 표시가 붙고 한 번 탭하면 전환됩니다.

**휴대폰에서 서버 시작.** 컴퓨터의 서버가 꺼져 있으면 앱에 “시작하기” 버튼이 나타납니다.

**어디서든 에이전트에게 응답.** 에이전트가 허가를 요청하면 어느 화면에서나 배너가 뜨고, 알림에도 같은 버튼이 있습니다.

**말로 대화.** 헤드셋을 탭해 말하고 답을 들으면 다시 듣기 시작합니다.

**OpenCode로 공유, 세션 검색과 고정.**

**터미널, 파일, MCP 커넥터,** 변경 비교, 이미지 첨부, 여러 서버, 생체 인증 잠금, 자격 증명은 Android Keystore에 저장.

## 세 단계로 설치 (약 2분)

**[문제 해결이 포함된 전체 가이드](../INSTALL.ko.md)**

**1. 컴퓨터: 명령어 하나 붙여넣기.** PowerShell(Windows)에서:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

macOS / Linux는 터미널에서:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

없는 것(Node.js, opencode, Tailscale)을 설치하고, Tailscale 로그인을 한 번 요청하고, 서버를 시작한 뒤 QR 코드 두 개가 있는 페이지를 엽니다.

**2. 휴대폰: 설치.** 첫 번째 QR 코드를 스캔하거나 [Releases](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)를 열어 APK를 내려받아 실행하세요. Tailscale도 설치하고 같은 계정으로 로그인합니다.

**3. 휴대폰: 페어링.** 앱을 열고 **QR 스캔하여 페어링**을 탭한 뒤 두 번째 QR 코드에 향하고 **연결**을 탭하세요.

명령을 다시 실행해도 안전합니다(중복되지 않고 복구됨). Tailscale이 싫다면 `-Mode lan`(같은 Wi-Fi) 또는 `-Mode tunnel`(무료 Cloudflare 터널, 장단점은 가이드 참고).

### AI 에이전트에게 맡기기

에이전트(Claude Code, opencode, Codex 등)에게 이렇게 말하세요: *“https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md 를 따라 OpenCode Mobile을 설정해 줘”*

디자인, 에이전트용 휴대폰 도구, 소스에서 빌드하는 방법은 [영어 README](../../README.md)를 참고하세요.

## 개인정보 보호

분석 없음, 충돌 보고 없음, 계정 없음. 앱은 내가 추가한 서버하고만 통신합니다. 그 밖의 유일한 요청은 업데이트를 알려 주기 위한, 하루 한 번의 선택적인 이 프로젝트 GitHub 릴리스 확인입니다. 자격 증명은 Android Keystore에 저장됩니다.

## 라이선스

MIT. [LICENSE](../../LICENSE)를 참고하세요.
