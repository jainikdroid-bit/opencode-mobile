# Kurulum rehberi

**Diller:** [English](INSTALL.md) · [Русский](INSTALL.ru.md) · [中文](INSTALL.zh-Hans.md) · [Español](INSTALL.es.md) · [Deutsch](INSTALL.de.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [Українська](INSTALL.uk.md) · Türkçe

AgentLink, **kendi bilgisayarınızda** çalışan kodlama ajanını yöneten bir Android uygulamasıdır. Kurulum yaklaşık
iki dakika ve üç adım sürer. Bizim hiçbir bulut hizmetimizden geçmez: telefon, bilgisayarınızla özel bir bağlantı üzerinden konuşur.

## İhtiyacınız olanlar

- Bir **Android telefon** (Android 7 veya üzeri).
- Windows 10/11, macOS veya Linux yüklü, açık ve internete bağlı bir **bilgisayar**.
- Ücretsiz bir **Tailscale** hesabı (Google, Microsoft veya GitHub ile giriş). Telefon ile bilgisayar arasındaki özel bağlantıdır.
  İstemiyor musunuz? [Diğer bağlanma yollarına](#diğer-bağlanma-yolları) bakın.

## Adım 1. Bilgisayarda: tek bir komut yapıştırın

**Windows.** **PowerShell**'i açın (Başlat menüsü, `PowerShell` yazın) ve şunu yapıştırın:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))
```

**macOS veya Linux.** **Terminal**'i açın ve şunu yapıştırın:

```sh
curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh
```

Betik çalışırken her adımı açıklar:

1. Eksik olanları kurar (Node.js, opencode). Windows izin isterse **Evet**'e tıklayın.
2. **Tailscale**'i kurar ve bir giriş sayfası açar. Google, Microsoft veya GitHub'ı seçin. İhtiyacınız olan tek hesap budur.
3. Sunucuyu başlatır ve **iki QR kodu** olan bir sayfa açar (biri uygulama için, biri eşleştirme için).

Komutu istediğiniz zaman güvenle tekrar çalıştırabilirsiniz: çoğaltmaz, onarır.

## Adım 2. Telefonda: uygulamayı kurun

1. **İlk** QR kodunu tarayın ya da [sürümler sayfasını](https://github.com/jainikdroid-bit/opencode-mobile/releases/latest) açıp
   `OpenCode-Mobile-<sürüm>.apk` dosyasını indirin ve açın. Android, tarayıcıdan kuruluma bir kez izin sorar: izin verin.
2. Google Play'den **Tailscale**'i kurun ve bilgisayardaki **aynı hesapla** giriş yapın.

## Adım 3. Telefonda: bağlanın

Uygulamayı açın, **Eşleşmek için QR tara**'ya dokunun, kamerayı **ikinci** QR koduna tutun ve **Bağlan**'a dokunun. Bitti.

İlk açılışta uygulama kısa bir kurulum rehberi gösterir; kalıcı olarak kapatmak için **Kılavuzu atla**'ya dokunun.

## Kurulumdan sonra

- **Günlük kullanım:** uygulamayı açmanız yeterli. Küçük gizli bir yardımcı (*başlatıcı*) bilgisayarınızla birlikte açılır ve
  sunucuyu ayağa kaldırır. Sunucu kapalıysa uygulama bir **Başlat** düğmesi gösterir. Bilgisayar açık ve çevrimiçi olmalıdır:
  uyku modundaki bir bilgisayarı hiçbir şey uyandıramaz.
- **Kontrol veya onarım:** aynı komutu yeniden çalıştırın ya da `-Doctor` (yalnızca kontrol) / `-Stop` (sunucuyu durdur) ekleyin.
- **Her şeyi kaldırma:** `-Uninstall` ekleyin. Ayarlarınız silebileceğiniz bir klasörde kalır (betik nerede olduğunu yazdırır).

Seçenekler komuttan sonra yazılır. Windows'ta `-Doctor` biçiminde; macOS/Linux'ta `sh -s --` sonrasına `--doctor` biçiminde:
`curl -fsSL <url> | sh -s -- --doctor`.

## Diğer bağlanma yolları

| Durum | Ekleyin | Ne yapar |
|---|---|---|
| Telefon ve bilgisayar aynı Wi-Fi'de, Tailscale istemiyorsunuz | `-Mode lan` (`--mode lan`) | Yalnızca ev ağınızda erişilebilir, hiç hesap gerekmez |
| Telefonda VPN yok | `-Mode tunnel` (`--mode tunnel`) | Ücretsiz Cloudflare tüneli, aşağıdaki uyarıya bakın |
| Açıklamaları atla | `-NoGuide` (`--no-guide`) | Sessiz çıktı |
| Oturum açılınca yardımcıyı başlatma | `-NoAutostart` (`--no-autostart`) | Sunucu yalnızca komutu çalıştırdığınızda başlar |

### Tünel modu, açık sözlü

`-Mode tunnel`, ücretsiz `cloudflared` istemcisini indirir ve yalnızca dışarı yönlü bir Cloudflare tüneli açar (hesap yok, açık port yok).
Adres **herkese açık internette**dir; uzun rastgele bir parola ve tahmin edilemez bir adresle korunur; aynı istemciden 10 yanlış denemeden sonra
bir dakika engellenir. Tünel yeniden başladığında adres değişir ve uygulama yenisini kendiliğinden öğrenir. Eşleştirme bağlantınızı ele geçiren
herkes ajanınızı kullanabilir, bu yüzden asla paylaşmayın. Varsayılan olarak Tailscale önerilmeye devam eder.

## Kullanışlı özellikler

- **OpenCode'a paylaş:** herhangi bir uygulamada Paylaş'a dokunup OpenCode'u seçin; metin, bağlantı, görsel ve küçük metin dosyaları bir oturuma düşer.
- **Sesli konuşma:** mikrofonun yanındaki kulaklığa dokunun, konuşun, yanıtı dinleyin; uygulama yeniden dinlemeye geçer.
- **Hızlı izinler:** ajan bir şey çalıştırmak istediğinde bir afiş (ve bildirim) Reddet / Her zaman / İzin ver seçeneklerini sunar.
- **Oturumlarda arama ve sabitleme:** oturumlar ekranında arama kutusu; bir oturuma uzun basarak sabitleyin.
- **Ajan için telefon araçları (isteğe bağlı, varsayılan kapalı):** yükleyiciyi `-PhoneTools` (`--phone-tools`) ile çalıştırın, ardından uygulamada
  *Ayarlar → Yapay zekâ ajanı için telefon araçları* seçeneğini açın. Ajan bildirim gösterebilir, sesli okuyabilir, panoyu kullanabilir,
  konumunuzu alabilir veya sizden fotoğraf çekmenizi isteyebilir. Hassas işlemler her seferinde sorar ve yalnızca uygulama açıkken çalışır.

## Bir yapay zekâ ajanı yapsın

Ajanınıza (Claude Code, opencode, Codex, ...) şunu söyleyin:

> AgentLink'ı benim için kur. https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/AI-SETUP.md adresini izle

Siz yalnızca Windows isteminde **Evet**'e tıklarsınız, Tailscale'e bir kez giriş yaparsınız ve telefonda **Bağlan**'a dokunursunuz.

## Sorun giderme

| Sorun | Çözüm |
|---|---|
| Uygulama bağlanamıyor | Telefon ve bilgisayar **aynı** Tailscale hesabını kullanmalı. Telefonda Tailscale'i açıp etkin olduğundan emin olun. |
| Komutu yapıştırdıktan sonra hiçbir şey açılmıyor | `-NoOpen` ile yeniden çalıştırın ve sayfa yerine yazdırdığı eşleştirme bağlantısını kullanın. |
| "Betik çalıştırma devre dışı" | Komutu gösterildiği gibi yapıştırın (betik izni gerektirmez); `.ps1` dosyası olarak kaydetmeyin. |
| Kamera QR kodunu algılamıyor | Uygulamanın kendi **Eşleşmek için QR tara** özelliğini kullanın ya da yazdırılan bağlantıyı **Bağlantı ekle → Eşleştirme bağlantısını yapıştır** alanına kopyalayın. |
| Eşleştirme bağlantısı reddedildi | Parola değişti (`-Rotate`) veya bağlantı kesilmiş. Komutu yeniden çalıştırın ve yeni bağlantıyı kullanın. |
| Sunucu kapalı ve telefon başlatamıyor | Bilgisayar uyku modunda veya çevrimdışı ya da yardımcı kaldırılmış. Bilgisayarı açın veya komutu yeniden çalıştırın. |

## Desteklenen platformlar

| | Bilgisayar | Telefon |
|---|---|---|
| Windows 10/11 | test edildi | yok |
| Linux | destekleniyor (systemd veya XDG otomatik başlatma), az test edildi | yok |
| macOS | destekleniyor (LaunchAgent), gerçek donanımda henüz test edilmedi | yok |
| Android | yok | test edildi |
| iOS | yok | kod uyumlu, ancak iOS sürümü derlenmedi veya test edilmedi |
