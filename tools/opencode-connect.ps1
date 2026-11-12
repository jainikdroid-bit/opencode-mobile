<#
OpenCode Connect (self-hosted): pair the phone app with this computer in one scan.

  pwsh -File tools/opencode-connect.ps1            start the server, publish it on your Tailscale
                                                   network only, print a QR code + pairing link
  pwsh -File tools/opencode-connect.ps1 -Stop      stop the server and remove the Tailscale forward
  pwsh -File tools/opencode-connect.ps1 -DryRun    print what would happen, change nothing

How it stays private:
  * `opencode serve` is bound to 127.0.0.1 only (never 0.0.0.0).
  * `tailscale serve --tcp` forwards the tailnet address to that local port, so only your own
    devices on your tailnet can reach it. Nothing is opened to the public internet and no hosted
    relay is involved.
  * A fresh random password protects the server; it travels only inside the pairing link/QR code.
  * The link is shown on this screen only. Do not paste it anywhere you do not trust.

Requirements: opencode, Tailscale (signed in, same account as the phone), the OpenCode Mobile fork.
For the QR code: `uv` (runs `segno` in an isolated, throw-away environment). Without it the
pairing link is printed and can be opened/pasted on the phone.
#>
param(
    [int]$Port = 4096,
    [string]$Name = $env:COMPUTERNAME,
    [switch]$Stop,
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

function Find-Tool([string]$exe, [string[]]$extra = @()) {
    $cmd = Get-Command $exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in $extra) { if (Test-Path $p) { return $p } }
    return $null
}

$tailscale = Find-Tool 'tailscale' @('C:\Program Files\Tailscale\tailscale.exe')
if (-not $tailscale) { throw 'Tailscale not found. Install it and sign in with the same account as the phone.' }

if ($Stop) {
    Get-CimInstance Win32_Process -Filter "Name like 'opencode%'" |
        Where-Object { $_.CommandLine -match "serve.*--port $Port" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    & $tailscale serve --tcp=$Port off | Out-Null
    Write-Host "Stopped: opencode serve on 127.0.0.1:$Port and the Tailscale forward for tcp/$Port."
    return
}

$opencode = Find-Tool 'opencode'
if (-not $opencode) { throw 'opencode not found in PATH.' }

$ip = (& $tailscale ip -4 | Select-Object -First 1).Trim()
if (-not $ip) { throw 'Tailscale has no IPv4 address. Is it signed in and connected?' }

# 24 random characters from an unambiguous alphabet (no look-alikes), cryptographically random.
$alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })

$serverUrl = "http://${ip}:${Port}"
$link = 'opencode://connect?url={0}&password={1}&name={2}' -f `
    [uri]::EscapeDataString($serverUrl), [uri]::EscapeDataString($password), [uri]::EscapeDataString($Name)

if ($DryRun) {
    Write-Host "[dry run] would run: opencode serve --hostname 127.0.0.1 --port $Port  (password set via OPENCODE_SERVER_PASSWORD)"
    Write-Host "[dry run] would run: tailscale serve --bg --tcp $Port tcp://127.0.0.1:$Port"
    Write-Host "[dry run] phone would connect to: $serverUrl"
    return
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Run with -Stop first, or pick another -Port."
}

$env:OPENCODE_SERVER_PASSWORD = $password
Start-Process -FilePath $opencode -ArgumentList 'serve', '--hostname', '127.0.0.1', '--port', "$Port" -WindowStyle Hidden | Out-Null
Remove-Item Env:\OPENCODE_SERVER_PASSWORD

$ready = $false
for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
    Start-Sleep -Milliseconds 500
    $ready = [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}
if (-not $ready) { throw 'opencode serve did not start listening in 15 s.' }

& $tailscale serve --bg --tcp $Port "tcp://127.0.0.1:$Port" | Out-Null

Write-Host ''
Write-Host "Server is up: $serverUrl  (reachable only inside your tailnet)" -ForegroundColor Green
Write-Host 'Scan this QR code with the phone camera (or paste the link in the app: Add connection -> Paste pairing link):'
Write-Host ''

$uv = Find-Tool 'uv'
if ($uv) {
    # The QR uses block characters; force UTF-8 so a legacy Windows console codepage cannot break it.
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $env:PYTHONIOENCODING = 'utf-8'
    try { & $uv run --quiet --with segno python -c "import segno,sys; segno.make(sys.argv[1], error='m').terminal(compact=True)" $link } catch { Write-Host '(QR code could not be drawn; use the link below)' }
} else {
    Write-Host '(uv not found, so no QR code; use the link below)'
}
Write-Host ''
Write-Host $link
Write-Host ''
Write-Host "Stop later with:  pwsh -File tools/opencode-connect.ps1 -Stop"
