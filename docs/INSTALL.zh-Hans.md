# 安装指南

**语言：** [English](INSTALL.md) · [Русский](INSTALL.ru.md) · 中文 · [Español](INSTALL.es.md) · [Deutsch](INSTALL.de.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [Українська](INSTALL.uk.md) · [Türkçe](INSTALL.tr.md)

OpenCode Mobile 是一款 Android 应用，用来控制运行在**你自己电脑**上的编码代理。设置大约需要两分钟、三个步骤。
不经过我们的任何云服务：手机通过私有连接与你的电脑通信。

## 你需要准备

- 一部 **Android 手机**（Android 7 或更高版本）。
- 一台 **电脑**：Windows 10/11、macOS 或 Linux，开机并联网。
- 一个免费的 **Tailscale** 账号（可用 Google、Microsoft 或 GitHub 登录）。它是手机与电脑之间的私有通道。
  不想用？见[其他连接方式](#其他连接方式)。

## 第 1 步：在电脑上粘贴一条命令

**Windows。** 打开 **PowerShell**（开始菜单，输入 `PowerShell`），粘贴：

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS 或 Linux。** 打开**终端**，粘贴：

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

脚本会在运行时解释每一步：

1. 安装缺少的组件（Node.js、opencode）。如果 Windows 请求权限，点击**是**。
2. 安装 **Tailscale** 并打开登录页面。选择 Google、Microsoft 或 GitHub。这是你唯一需要的账号。
3. 启动服务器，并打开一个带有**两个二维码**的页面（一个用于安装应用，一个用于配对）。

随时可以放心地再次运行这条命令：它会修复而不是重复安装。

## 第 2 步：在手机上安装应用

1. 扫描**第一个**二维码，或打开[发布页面](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest)，
   下载 `OpenCode-Mobile-<版本>.apk` 并打开。Android 会询问一次是否允许从浏览器安装：请允许。
2. 从 Google Play 安装 **Tailscale**，并用与电脑**相同的账号**登录。

## 第 3 步：在手机上连接

打开应用，点击**扫描二维码配对**，对准**第二个**二维码，然后点击**连接**。完成。

首次打开应用时会显示简短的设置向导；点击**跳过向导**即可永久关闭。

## 设置之后

- **日常使用：**直接打开应用。一个隐藏的小助手（*启动器*）会随电脑启动并拉起服务器。如果服务器关闭了，应用会显示**启动**按钮。
  电脑必须开机并联网：无法唤醒已休眠的电脑。
- **检查或修复：**再次运行同一条命令，或添加 `-Doctor`（仅检查）/ `-Stop`（停止服务器）。
- **全部移除：**添加 `-Uninstall`。你的设置保存在一个可以删除的文件夹中（脚本会打印位置）。

参数写在命令之后。Windows 上写作 `-Doctor`；macOS/Linux 上写作 `--doctor`，并放在 `sh -s --` 之后：
`curl -fsSL <url> | sh -s -- --doctor`。

## 其他连接方式

| 情况 | 添加参数 | 作用 |
|---|---|---|
| 手机和电脑在同一 Wi-Fi，不想用 Tailscale | `-Mode lan`（`--mode lan`） | 仅在家庭网络内可访问，无需任何账号 |
| 手机上没有 VPN | `-Mode tunnel`（`--mode tunnel`） | 免费的 Cloudflare 隧道，见下方说明 |
| 跳过说明 | `-NoGuide`（`--no-guide`） | 安静输出 |
| 登录系统时不启动助手 | `-NoAutostart`（`--no-autostart`） | 只有运行命令时才启动服务器 |

### 隧道模式：坦率地说明取舍

`-Mode tunnel` 会下载免费的 `cloudflared` 客户端，并建立仅出站的 Cloudflare 隧道（无需账号，无需开放端口）。该地址**位于公共互联网**，
由很长的随机密码和难以猜测的地址保护；同一客户端连续错误 10 次后会被封锁一分钟。隧道重启时地址会变化，应用会自动获知新地址。
任何拿到你配对链接的人都能使用你的代理，所以请勿分享。默认仍推荐 Tailscale。

## 实用功能

- **分享到 OpenCode：**在任意应用中点击分享并选择 OpenCode；文本、链接、图片和小型文本文件会进入会话。
- **语音对话：**点击麦克风旁的耳机按钮，说话，听取回答，然后它会再次聆听。
- **快速授权：**代理请求执行操作时，横幅（以及通知）提供 拒绝 / 始终 / 允许。
- **搜索与置顶会话：**会话页面有搜索框；长按会话可置顶。
- **代理的手机功能（可选，默认关闭）：**用 `-PhoneTools`（`--phone-tools`）运行安装程序，然后在应用中开启*设置 → AI 代理的手机功能*。
  代理就能显示通知、朗读、使用剪贴板、获取位置，或请你拍照。敏感操作每次都会询问，且仅在应用打开时有效。

## 让 AI 代理替你完成

告诉你的代理（Claude Code、opencode、Codex 等）：

> 请帮我设置 OpenCode Mobile。按照 https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md 操作

你只需要在 Windows 弹窗中点击**是**，登录一次 Tailscale，并在手机上点击**连接**。

## 故障排除

| 问题 | 解决办法 |
|---|---|
| 应用无法连接 | 手机和电脑必须使用**同一个** Tailscale 账号。在手机上打开 Tailscale，确认已开启。 |
| 粘贴命令后什么都没打开 | 加上 `-NoOpen` 再运行，并使用它打印的配对链接代替页面。 |
| “已禁止运行脚本” | 请原样粘贴命令（它不需要脚本权限）；不要把它保存成 `.ps1` 文件。 |
| 相机识别不了二维码 | 使用应用内的**扫描二维码配对**，或把打印出的链接复制到**添加连接 → 粘贴配对链接**。 |
| 配对链接被拒绝 | 密码已更改（`-Rotate`），或链接被截断。重新运行命令并使用新链接。 |
| 服务器已关闭且手机无法启动它 | 电脑已休眠或离线，或助手已被移除。请开机，或重新运行命令。 |

## 支持的平台

| | 电脑 | 手机 |
|---|---|---|
| Windows 10/11 | 已测试 | 不适用 |
| Linux | 支持（systemd 或 XDG 自启动），测试较少 | 不适用 |
| macOS | 支持（LaunchAgent），尚未在真机上测试 | 不适用 |
| Android | 不适用 | 已测试 |
| iOS | 不适用 | 代码兼容，但尚未构建或测试 iOS 版本 |
