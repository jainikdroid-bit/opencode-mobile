<p align="center">
  <img src="../brand/rig.svg" width="140" alt="RIG" />
</p>

<h1 align="center">OpenCode Mobile</h1>

<p align="center">
  <b>ポケットの中のコーディングエージェント。</b><br/>
  ダークでミニマル、ネオンの縁取りのクライアント。エージェントが考え、動き、書く様子が見えます。
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.zh-Hans.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.pt.md">Português</a> ·
  <b>日本語</b> ·
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

[opencode](https://github.com/sst/opencode) エージェント用のネイティブ Android クライアントです。通信するのは**あなた**が動かすサーバーだけで、あなた自身のネットワーク経由です。中継サーバーやホスト型サービスは使いません。

> 独立したコミュニティ製クライアントで、opencode チームとは無関係です。

## 特長

**エージェントの動きが見える。** ライブの進行バーが段階（「考え中」「bash を使用中」「回答を作成中」）を示してタイマーを刻み、思考ブロックは「0:12 考えました」に折りたたまれます。

**1 回のスキャンでペアリング。** パソコンでスクリプトを 1 つ実行し、QR コードにカメラを向けて確認するだけ。サーバーは `127.0.0.1` のままで、Tailscale ネットワーク内だけに公開されます。

**モデルはローカルでもクラウドでも。** 「すべて / ローカル / クラウド」フィルター。手元のパソコンのモデルには印が付き、1 タップで切り替えられます。

**スマートフォンからサーバーを起動。** パソコンのサーバーが止まっていると、アプリに「開始」ボタンが出ます。

**どこからでもエージェントに返答。** 許可を求められると、どの画面でもバナーが出て、通知にも同じボタンがあります。

**話しかける。** ヘッドセットをタップして話し、返答を聞くと、また聞き取りを始めます。

**OpenCode へ共有、セッションの検索と固定。**

**ターミナル、ファイル、MCP コネクタ、** 差分表示、画像添付、複数サーバー、生体認証ロック、認証情報は Android Keystore に保存。

## 3 ステップでインストール（約 2 分）

**[トラブルシューティング付きの完全ガイド](../INSTALL.ja.md)**

**1. パソコン：コマンドを 1 つ貼り付け。** PowerShell（Windows）で：

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

macOS / Linux はターミナルで：

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

足りないもの（Node.js、opencode、Tailscale）をインストールし、Tailscale へのログインを一度求め、サーバーを起動して、2 つの QR コードがあるページを開きます。

**2. スマートフォン：インストール。** 1 つ目の QR コードを読み取る（または [Releases](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest) を開く）、APK をダウンロードして開きます。Tailscale も入れて同じアカウントでログインします。

**3. スマートフォン：ペアリング。** アプリを開き、**QR をスキャンしてペアリング**をタップして 2 つ目の QR コードに向け、**接続**をタップします。

コマンドの再実行は安全です（重複せず修復します）。Tailscale が不要なら `-Mode lan`（同じ Wi-Fi）または `-Mode tunnel`（無料の Cloudflare トンネル。トレードオフはガイドを参照）。

### AI エージェントにお任せ

お使いのエージェント（Claude Code、opencode、Codex など）にこう伝えてください：*「https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md に従って OpenCode Mobile をセットアップして」*

デザイン、エージェント用スマートフォンツール、ソースからのビルドは[英語版 README](../../README.md) をご覧ください。

## プライバシー

解析なし、クラッシュレポートなし、アカウントなし。アプリは、あなたが追加したサーバーとだけ通信します。ほかの通信は、更新をお知らせするための、1 日 1 回・任意の本プロジェクトの GitHub リリース確認だけです。認証情報は Android Keystore に保存されます。

## ライセンス

MIT。[LICENSE](../../LICENSE) を参照してください。
