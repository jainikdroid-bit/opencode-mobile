<#
.SYNOPSIS
  OpenCode Connect: one command that sets up opencode on this computer and pairs the phone app.

.DESCRIPTION
  Run it and it will, step by step and idempotently:
    1. install Node.js and opencode if they are missing (winget / npm, silent),
    2. install Tailscale if it is missing and wait for you to sign in (the only account step),
    3. start `opencode serve` on 127.0.0.1 with a stable random password,
    4. publish that port inside your private Tailscale network (never the public internet),
    5. show a QR code (and open a page with it) that the phone app scans to pair.
  Running it again changes nothing that is already fine, so it doubles as "repair".

  Privacy: the server is bound to 127.0.0.1 and only your own tailnet devices can reach it through
  `tailscale serve`. The password lives in %LOCALAPPDATA%\opencode-connect and in the pairing QR only.

.PARAMETER Mode
  tailscale (default): reachable from anywhere through your Tailscale network, needs one sign-in.
  lan:    reachable on this Wi-Fi/LAN only, no account at all (binds the LAN address, not 0.0.0.0).
  local:  127.0.0.1 only (for tests; -HostName 10.0.2.2 pairs the Android emulator).

.EXAMPLE
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))

.EXAMPLE
  .\opencode-connect.ps1 -NoGuide     # skip the step-by-step explanations, just do it
  .\opencode-connect.ps1 -Json        # for AI agents: progress on stderr, one JSON object on stdout
  .\opencode-connect.ps1 -Doctor      # check everything, change nothing
  .\opencode-connect.ps1 -Stop        # stop the server and remove the Tailscale forward

  Exit codes: 0 ok, 1 failed, 2 a human has to do something (see "needs" in the JSON).
#>
[CmdletBinding()]
param(
    [ValidateSet('tailscale', 'lan', 'local')][string]$Mode = 'tailscale',
    [int]$Port = 4096,
    [string]$Name = $env:COMPUTERNAME,
    [string]$HostName,
    [switch]$NoInstall,
    [switch]$Json,
    [switch]$NoGuide,
    [switch]$NoOpen,
    [switch]$NoQr,
    [switch]$Rotate,
    [switch]$Autostart,
    [switch]$Status,
    [switch]$Doctor,
    [switch]$Stop,
    [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$ScriptUrl = 'https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1'
$AppUrl = 'https://github.com/jainikdroid-bit/opencode-mobile/releases/latest'
$Dir = if ($env:OPENCODE_CONNECT_DIR) { $env:OPENCODE_CONNECT_DIR } else { Join-Path $env:LOCALAPPDATA 'opencode-connect' }
$PwFile = Join-Path $Dir 'password'
$StateFile = Join-Path $Dir 'state.json'
$steps = New-Object System.Collections.ArrayList
$result = [ordered]@{ ok = $false; stage = 'start'; needs = $null; message = ''; appUrl = $AppUrl; steps = $steps }

# ---------- output helpers (stdout stays clean in -Json mode) ----------
function Say([string]$text, [string]$color = 'Gray') {
    if ($Json) { [Console]::Error.WriteLine($text) } else { Write-Host $text -ForegroundColor $color }
}
function Note-Step([string]$name, [string]$state, [string]$detail = '') {
    [void]$steps.Add([ordered]@{ step = $name; state = $state; detail = $detail })
    $mark = switch ($state) { 'ok' { '[ok]' } 'did' { '[+] ' } 'skip' { '[-] ' } 'need' { '[!] ' } default { '[x] ' } }
    $color = switch ($state) { 'ok' { 'Green' } 'did' { 'Cyan' } 'need' { 'Yellow' } 'fail' { 'Red' } default { 'Gray' } }
    Say ("{0} {1} {2}" -f $mark, $name, $detail).TrimEnd() $color
}
function Finish([int]$code) {
    if ($Json) { [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 6 -Compress)) }
    exit $code
}
function Fail([string]$stage, [string]$message) {
    $result.stage = $stage; $result.message = $message
    Note-Step $stage 'fail' $message
    Finish 1
}
function Need([string]$what, [string]$message, [hashtable]$extra = @{}) {
    $result.stage = $what; $result.needs = $what; $result.message = $message
    foreach ($k in $extra.Keys) { $result[$k] = $extra[$k] }
    Note-Step $what 'need' $message
    Finish 2
}

# ---------- step-by-step guide (hidden with -NoGuide or -Json) ----------
$guideTotal = if ($Mode -eq 'tailscale') { 4 } else { 3 }
$guideN = 0
function Guide-Step([string]$title, [string]$what, [string]$you) {
    $script:guideN++
    if ($Json -or $NoGuide -or $DryRun) { return }
    Say ''
    Say ("Step {0}/{1}: {2}" -f $script:guideN, $guideTotal, $title) 'Cyan'
    Say "  $what" 'DarkGray'
    Say "  You: $you" 'DarkGray'
}

# ---------- environment helpers ----------
function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}
function Find-Exe([string]$name, [string[]]$extra = @()) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
    foreach ($p in $extra) { if ($p -and (Test-Path $p)) { return $p } }
    return $null
}
function Find-Tailscale { Find-Exe 'tailscale.exe' @("$env:ProgramFiles\Tailscale\tailscale.exe", "${env:ProgramFiles(x86)}\Tailscale\tailscale.exe") }
function Find-OpencodeCmd { Find-Exe 'opencode.cmd' @("$env:APPDATA\npm\opencode.cmd") }
function Install-Winget([string]$id, [string]$label) {
    if ($NoInstall) { Fail "install-$label" "$label is missing and -NoInstall was given." }
    $winget = Find-Exe 'winget.exe'
    if (-not $winget) { Need "install-$label" "$label is missing and winget is not available. Install $label manually, then run this again." }
    Say "Installing $label (a Windows permission prompt may appear: click Yes)..." 'Cyan'
    & $winget install -e --id $id --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
    Update-SessionPath
}
function Get-Listener([int]$port) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}
function Test-Health([int]$port, [string]$password, [string]$hostName = '127.0.0.1') {
    try {
        $auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("opencode:$password"))
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 -Uri "http://${hostName}:$port/global/health" -Headers @{ Authorization = $auth }
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}
function New-Password {
    $alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
}
function Get-LanIp {
    $cfg = Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1
    if ($cfg) { return $cfg.IPv4Address[0].IPAddress }
    return $null
}

# ---------- state ----------
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$state = $null
if (Test-Path $StateFile) { try { $state = Get-Content $StateFile -Raw | ConvertFrom-Json } catch { $state = $null } }
if ($state -and -not $PSBoundParameters.ContainsKey('Port') -and $state.port) { $Port = [int]$state.port }
if ($state -and -not $PSBoundParameters.ContainsKey('Mode') -and $state.mode) { $Mode = [string]$state.mode }
$result.mode = $Mode

# ---------- stop ----------
if ($Stop) {
    $l = Get-Listener $Port
    if ($l) { & taskkill.exe /F /T /PID $l.OwningProcess 2>&1 | Out-Null; Note-Step 'server' 'did' "stopped (port $Port)" } else { Note-Step 'server' 'skip' 'was not running' }
    $ts = Find-Tailscale
    if ($ts -and $Mode -eq 'tailscale') { & $ts serve --tcp=$Port off 2>&1 | Out-Null; Note-Step 'tailscale forward' 'did' "removed tcp/$Port" }
    $result.ok = $true; $result.stage = 'stopped'
    Finish 0
}

# ---------- doctor / status (read-only) ----------
if ($Doctor -or $Status) {
    $node = Find-Exe 'node.exe'
    $oc = Find-OpencodeCmd
    $ts = Find-Tailscale
    $pw = if (Test-Path $PwFile) { (Get-Content $PwFile -Raw).Trim() } else { $null }
    $listening = [bool](Get-Listener $Port)
    $tsState = $null; $tsIp = $null
    if ($ts) {
        try { $tsState = ((& $ts status --json 2>$null) | ConvertFrom-Json).BackendState } catch { $tsState = 'unknown' }
        $tsIp = (& $ts ip -4 2>$null | Select-Object -First 1)
    }
    $result.doctor = [ordered]@{
        node = [bool]$node; opencode = [bool]$oc; tailscaleInstalled = [bool]$ts; tailscaleState = $tsState; tailscaleIp = $tsIp
        passwordSaved = [bool]$pw; port = $Port; serverListening = $listening
        serverHealthy = [bool]($pw -and $listening -and (Test-Health $Port $pw))
    }
    foreach ($k in $result.doctor.Keys) { Say ("  {0,-20} {1}" -f $k, $result.doctor[$k]) }
    $result.ok = $true; $result.stage = 'doctor'
    Finish 0
}

Say ''
Say 'OpenCode Connect' 'Cyan'
Say "Mode: $Mode$(if ($DryRun) { '  (dry run: nothing will be changed)' })" 'DarkGray'
Say ''

# ---------- 1. Node.js + opencode ----------
Guide-Step 'Prepare this computer' 'Installs Node.js and opencode if they are missing (silent).' 'nothing, or click Yes if Windows asks permission'
$node = Find-Exe 'node.exe' @("$env:ProgramFiles\nodejs\node.exe")
if (-not $node) {
    if ($DryRun) { Note-Step 'node' 'need' 'would install Node.js LTS' } else {
        Install-Winget 'OpenJS.NodeJS.LTS' 'Node.js'
        $node = Find-Exe 'node.exe' @("$env:ProgramFiles\nodejs\node.exe")
        if (-not $node) { Fail 'node' 'Node.js did not install. Install it from nodejs.org and run this again.' }
        Note-Step 'node' 'did' 'installed'
    }
} else { Note-Step 'node' 'ok' }

$ocCmd = Find-OpencodeCmd
if (-not $ocCmd) {
    if ($DryRun) { Note-Step 'opencode' 'need' 'would run: npm install -g opencode-ai' } else {
        if ($NoInstall) { Fail 'opencode' 'opencode is missing and -NoInstall was given.' }
        Say 'Installing opencode (npm)...' 'Cyan'
        & npm.cmd install -g opencode-ai --no-audit --no-fund --silent 2>&1 | Out-Null
        Update-SessionPath
        $ocCmd = Find-OpencodeCmd
        if (-not $ocCmd) { Fail 'opencode' 'npm install -g opencode-ai failed. Run it manually and try again.' }
        Note-Step 'opencode' 'did' 'installed'
    }
} else { Note-Step 'opencode' 'ok' }

# ---------- 2. Tailscale (only in tailscale mode) ----------
if ($Mode -eq 'tailscale') { Guide-Step 'Private link (Tailscale)' 'Installs Tailscale if needed. It connects your phone and this computer privately, from anywhere.' 'sign in once in the page that opens (Google / Microsoft / GitHub)' }
$tsExe = $null; $tsIp = $null
if ($Mode -eq 'tailscale') {
    $tsExe = Find-Tailscale
    if (-not $tsExe) {
        if ($DryRun) { Note-Step 'tailscale' 'need' 'would install Tailscale' } else {
            Install-Winget 'Tailscale.Tailscale' 'Tailscale'
            $tsExe = Find-Tailscale
            if (-not $tsExe) { Fail 'tailscale' 'Tailscale did not install. Install it from tailscale.com/download and run this again.' }
            Note-Step 'tailscale' 'did' 'installed'
        }
    } else { Note-Step 'tailscale' 'ok' }

    if ($tsExe -and $DryRun) { $tsIp = (& $tsExe ip -4 2>$null | Select-Object -First 1) }
    if ($tsExe -and -not $DryRun) {
        function Get-TsStatus { try { (& $tsExe status --json 2>$null) | ConvertFrom-Json } catch { $null } }
        $st = Get-TsStatus
        if (-not $st -or $st.BackendState -ne 'Running') {
            Say 'Tailscale needs you to sign in (once). Pick Google / Microsoft / GitHub in the page that opens.' 'Yellow'
            Start-Process -FilePath $tsExe -ArgumentList 'up' -WindowStyle Hidden | Out-Null
            $authUrl = $null
            $deadline = (Get-Date).AddSeconds(240)
            while ((Get-Date) -lt $deadline) {
                Start-Sleep -Seconds 2
                $st = Get-TsStatus
                if ($st -and $st.BackendState -eq 'Running') { break }
                if ($st -and $st.AuthURL -and -not $authUrl) {
                    $authUrl = [string]$st.AuthURL
                    if ($Json -or $NoOpen) { Need 'tailscale_login' 'Open this link, sign in to Tailscale, then run the command again.' @{ authUrl = $authUrl } }
                    Say "Sign-in page: $authUrl" 'Yellow'
                    Start-Process $authUrl | Out-Null
                }
            }
            if (-not $st -or $st.BackendState -ne 'Running') { Need 'tailscale_login' 'Tailscale sign-in was not finished in time. Run this command again after signing in.' @{ authUrl = $authUrl } }
            Note-Step 'tailscale sign-in' 'did'
        } else { Note-Step 'tailscale sign-in' 'ok' }
        $tsIp = (& $tsExe ip -4 2>$null | Select-Object -First 1)
        if (-not $tsIp) { Fail 'tailscale' 'Tailscale has no IPv4 address.' }
    }
}

# ---------- 3. password, host, port ----------
$bindHost = '127.0.0.1'
$linkHost = '127.0.0.1'
switch ($Mode) {
    'tailscale' { $linkHost = if ($tsIp) { $tsIp } else { '<tailscale-ip>' } }
    'lan' { $lan = Get-LanIp; if (-not $lan) { Fail 'lan' 'No LAN address found.' }; $bindHost = $lan; $linkHost = $lan }
    'local' { }
}
if ($HostName) { $linkHost = $HostName }

if ($DryRun) {
    Say ''
    Say "Would start: opencode serve --hostname $bindHost --port $Port" 'DarkGray'
    if ($Mode -eq 'tailscale') { Say "Would run: tailscale serve --bg --tcp $Port tcp://127.0.0.1:$Port" 'DarkGray' }
    Say "Phone would connect to: http://${linkHost}:$Port" 'DarkGray'
    $result.ok = $true; $result.stage = 'dry-run'
    Finish 0
}

$password = $null
if ((Test-Path $PwFile) -and -not $Rotate) { $password = (Get-Content $PwFile -Raw).Trim() }
if (-not $password) {
    $password = New-Password
    Set-Content -Path $PwFile -Value $password -NoNewline -Encoding ascii
    & icacls.exe $PwFile /inheritance:r /grant:r "${env:USERNAME}:(R,W)" 2>&1 | Out-Null
    Note-Step 'password' 'did' 'created (kept in your profile, pairing stays valid across restarts)'
} else { Note-Step 'password' 'ok' }

# ---------- 4. server ----------
Guide-Step 'Start the server' 'Runs opencode on this computer, reachable only by you.' 'nothing'
$listener = Get-Listener $Port
if ($listener -and (Test-Health $Port $password $bindHost)) {
    Note-Step 'server' 'ok' "already running on port $Port"
} else {
    if ($listener) {
        # something else holds the port: move to a free one
        foreach ($p in ($Port + 1)..($Port + 20)) { if (-not (Get-Listener $p)) { $Port = $p; break } }
        Note-Step 'port' 'did' "busy, using $Port"
    }
    $env:OPENCODE_SERVER_PASSWORD = $password
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "opencode serve --hostname $bindHost --port $Port" -WindowStyle Hidden | Out-Null
    Remove-Item Env:\OPENCODE_SERVER_PASSWORD -ErrorAction SilentlyContinue
    $up = $false
    for ($i = 0; $i -lt 40 -and -not $up; $i++) { Start-Sleep -Milliseconds 500; $up = Test-Health $Port $password $bindHost }
    if (-not $up) { Fail 'server' 'opencode serve did not become healthy in 20 s. Run "opencode serve" in a terminal to see why.' }
    Note-Step 'server' 'did' "started on $bindHost`:$Port"
}
@{ port = $Port; mode = $Mode; name = $Name } | ConvertTo-Json | Set-Content -Path $StateFile -Encoding ascii

# ---------- 5. publish ----------
if ($Mode -eq 'tailscale') {
    & $tsExe serve --bg --tcp $Port "tcp://127.0.0.1:$Port" 2>&1 | Out-Null
    Note-Step 'tailscale forward' 'ok' "tcp/$Port inside your tailnet only"
} elseif ($Mode -eq 'lan') {
    Say 'LAN mode: every device on this network can reach the server (password protected). If Windows asks about the firewall, click Allow.' 'Yellow'
}

if ($Autostart) {
    $copy = Join-Path $Dir 'connect.ps1'
    if ($PSCommandPath) { Copy-Item $PSCommandPath $copy -Force } else { try { Invoke-WebRequest -UseBasicParsing -Uri $ScriptUrl -OutFile $copy } catch { } }
    $vbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'opencode-connect.vbs'
    $cmdLine = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"$copy"""" -NoOpen -NoQr"
    Set-Content -Path $vbs -Value "CreateObject(""WScript.Shell"").Run ""$cmdLine"", 0, False" -Encoding ascii
    Note-Step 'autostart' 'did' 'the server will start when you sign in'
}

# ---------- 6. pairing link and QR ----------
Guide-Step 'Pair your phone' 'Shows two QR codes: one to get the app, one to connect.' 'about 3 taps on the phone (see below)'
if (-not $Json -and -not $NoGuide) {
    Say ''
    Say 'On your phone:' 'Cyan'
    Say "  1. Install the app: open $AppUrl and download the APK (the page on this computer has a QR for it)."
    if ($Mode -eq 'tailscale') { Say '  2. Install Tailscale from Google Play and sign in with the same account.' }
    Say "  $(if ($Mode -eq 'tailscale') { '3' } else { '2' }). Open the app, tap 'Scan QR to pair', point the camera at the QR code, tap Connect."
}
$link = 'opencode://connect?url={0}&password={1}&name={2}' -f [uri]::EscapeDataString("http://${linkHost}:$Port"), [uri]::EscapeDataString($password), [uri]::EscapeDataString($Name)
$result.serverUrl = "http://${linkHost}:$Port"
$result.pairingLink = $link
$result.ok = $true; $result.stage = 'ready'; $result.message = 'Install the app on the phone, then scan the pairing QR or open the pairing link on the phone.'

if (-not $NoQr -and $node) {
    $qrJs = Join-Path $Dir 'qr.js'
    if (-not (Test-Path (Join-Path $Dir 'node_modules\qrcode'))) {
        & npm.cmd install --prefix $Dir qrcode qrcode-terminal --no-audit --no-fund --silent 2>&1 | Out-Null
    }
    $js = @'
const [mode, link, appUrl, out] = process.argv.slice(2)
if (mode === 'term') {
  require('qrcode-terminal').generate(link, { small: true })
} else {
  const QR = require('qrcode')
  Promise.all([QR.toDataURL(link, { margin: 2, width: 440 }), QR.toDataURL(appUrl, { margin: 2, width: 260 })]).then(([pair, app]) => {
    const html = '<!doctype html><meta charset="utf-8"><title>OpenCode: pair your phone</title>' +
      '<body style="margin:0;background:#07080c;color:#e8ecf4;font-family:Consolas,monospace;text-align:center;padding:32px">' +
      '<h2 style="color:#22d3ee;letter-spacing:2px">OPENCODE CONNECT</h2>' +
      '<p>1. Install the app on the phone (skip if you already have it)</p><img src="' + app + '" width="200" style="background:#fff;border-radius:8px"><br>' +
      '<p>2. Install Tailscale on the phone (Google Play) and sign in with the same account. Skip in LAN mode.</p>' +
      '<p>3. Open the OpenCode app, tap Scan QR to pair, point it at this code, tap Connect</p><img src="' + pair + '" width="360" style="background:#fff;border-radius:8px">' +
      '<p style="color:#8a93a8;font-size:12px">This page holds your pairing password and deletes itself in 5 minutes.</p></body>'
    require('fs').writeFileSync(out, html)
  })
}
'@
    Set-Content -Path $qrJs -Value $js -Encoding utf8
    if (Test-Path (Join-Path $Dir 'node_modules\qrcode')) {
        if (-not $Json) {
            Say ''
            try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
            Say 'Point the phone at this code (app: Scan QR to pair):' 'Cyan'
            & node $qrJs term $link $AppUrl x
        }
        if (-not $NoOpen) {
            $page = Join-Path $env:TEMP 'opencode-pair.html'
            & node $qrJs html $link $AppUrl $page
            if (Test-Path $page) {
                Start-Process $page | Out-Null
                Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', "Start-Sleep 300; Remove-Item -Force '$page' -ErrorAction SilentlyContinue" | Out-Null
            }
        }
    } else { Say '(QR codes unavailable: could not install the QR helper. Use the link below.)' 'Yellow' }
}
if (-not $Json) {
    Say ''
    Say 'Pairing link (also works with "Paste pairing link" in the app):' 'DarkGray'
    Say $link 'DarkGray'
    Say ''
    Say 'Stop later:  opencode-connect.ps1 -Stop     Check:  opencode-connect.ps1 -Doctor' 'DarkGray'
}
Finish 0
