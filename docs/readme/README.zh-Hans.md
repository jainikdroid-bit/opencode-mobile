<p align="center">
  <img src="../brand/rig.svg" width="140" alt="RIG" />
</p>

<h1 align="center">OpenCode Mobile</h1>

<p align="center">
  <b>你口袋里的编码代理。</b><br/>
  深色、极简、带霓虹点缀的客户端，让你看到代理如何思考、工作和书写。
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <b>中文</b> ·
  <a href="README.es.md">Español</a> ·
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

[opencode](https://github.com/sst/opencode) 代理的原生 Android 客户端。它只与**你自己**运行的服务器通过你自己的网络通信，不经过任何中继或托管服务。

> 独立的社区客户端，与 opencode 团队无关。

## 亮点

**看见代理在做什么。** 实时活动条会显示阶段（“代理在思考”“正在使用 bash”“正在撰写回答”）并计时；推理块会折叠为“思考了 0:12”。

**一次扫描完成配对。** 在电脑上运行一个脚本，用手机相机扫二维码，确认即可。服务器保持在 `127.0.0.1`，仅在你的 Tailscale 网络内发布。

**本地或云端，任选模型。** “全部 / 本地 / 云端”筛选；来自你电脑的模型会被标注，一键切换。

**用手机启动服务器。** 电脑上的服务器关闭时，应用会显示“启动”按钮。

**随处回应代理。** 代理请求授权时，任何界面都会出现横幅；通知上也有同样的按钮。

**语音对话。** 点击耳机：说话、听回答，然后它再次聆听。

**分享到 OpenCode、搜索并置顶会话。**

**终端、文件、MCP 连接器、** 差异对比、图片附件、多服务器、生物识别锁、凭据存于 Android Keystore。

## 三步安装（约两分钟）

**[含故障排除的完整指南](../INSTALL.zh-Hans.md)**

**1. 电脑：粘贴一条命令。** 在 PowerShell（Windows）中：

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

macOS / Linux，在终端中：

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

它会安装缺少的组件（Node.js、opencode、Tailscale），请你登录一次 Tailscale，启动服务器，并打开带两个二维码的页面。

**2. 手机：安装。** 扫描第一个二维码（或打开 [Releases](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)），下载 APK 并打开。手机上也安装 Tailscale 并登录同一账号。

**3. 手机：配对。** 打开应用，点击**扫描二维码配对**，对准第二个二维码，点击**连接**。

重复运行命令是安全的（会修复而不是重复安装）。不想用 Tailscale？可用 `-Mode lan`（同一 Wi-Fi）或 `-Mode tunnel`（免费 Cloudflare 隧道，取舍见指南）。

### 让 AI 代理替你完成

告诉你的代理（Claude Code、opencode、Codex 等）：*“请按 https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md 为我设置 OpenCode Mobile。”*

设计、代理的手机工具以及从源码构建，请见[英文 README](../../README.md)。

## 隐私

没有统计分析，没有崩溃上报，没有账号。应用只与你添加的服务器通信。唯一的其他请求是每天一次、可选的检查本项目 GitHub 发布以提示更新。凭据保存在 Android Keystore 中。

## 许可证

MIT。见 [LICENSE](../../LICENSE)。
