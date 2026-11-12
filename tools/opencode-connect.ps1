<#
.SYNOPSIS
  OpenCode Connect (Windows launcher): makes sure Node.js exists, then runs tools/connect.js, the cross-platform core.

.DESCRIPTION
  One command sets up opencode on this computer and pairs the phone app: installs what is missing (silent),
  starts the server on 127.0.0.1, publishes it inside your private Tailscale network, starts a hidden launcher
  that lets the phone start the server later (autostart at sign-in), and shows a pairing QR. Safe to re-run.

.EXAMPLE
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))

.EXAMPLE
  .\opencode-connect.ps1 -NoGuide | -Json | -Doctor | -Stop | -Uninstall | -Mode lan | -NoAutostart | -DryRun

  Exit codes: 0 ok, 1 failed, 2 a human has to do something (see "needs" in the JSON).
#>
$ErrorActionPreference = 'Continue'
$BaseUrl = 'https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools'
$Dir = if ($env:OPENCODE_CONNECT_DIR) { $env:OPENCODE_CONNECT_DIR } else { Join-Path $env:LOCALAPPDATA 'opencode-connect' }
$json = $args -contains '-Json'
function Say([string]$t) { if ($json) { [Console]::Error.WriteLine($t) } else { Write-Host $t -ForegroundColor Cyan } }

function Update-SessionPath {
    $env:Path = (@([Environment]::GetEnvironmentVariable('Path', 'Machine'), [Environment]::GetEnvironmentVariable('Path', 'User')) | Where-Object { $_ }) -join ';'
}
function Find-Node {
    $c = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.Source }
    $p = "$env:ProgramFiles\nodejs\node.exe"
    if (Test-Path $p) { return $p }
    return $null
}

$node = Find-Node
if (-not $node -and ($args -notcontains '-NoInstall') -and ($args -notcontains '-DryRun')) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($winget) {
        Say 'Installing Node.js (a Windows permission prompt may appear: click Yes)...'
        & $winget.Source install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
        Update-SessionPath
        $node = Find-Node
    }
}
if (-not $node) {
    $msg = 'Node.js is missing. Install it from https://nodejs.org and run this again.'
    if ($json) { [Console]::Out.WriteLine('{"ok":false,"stage":"node","needs":"install-node","message":"' + $msg + '"}') } else { Write-Host $msg -ForegroundColor Yellow }
    exit 2
}

# connect.js lives next to this script when it is run from a checkout; otherwise download it with its two helpers
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$core = if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot 'connect.js'))) { $PSScriptRoot } else { Join-Path $Dir 'core' }
if ($core -ne $PSScriptRoot) {
    New-Item -ItemType Directory -Force -Path $core | Out-Null
    foreach ($f in 'connect.js', 'launcher.js', 'autostart.js') {
        try { Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/$f" -OutFile (Join-Path $core $f) } catch { Say "Could not download $f"; exit 1 }
    }
}
& $node (Join-Path $core 'connect.js') @args
exit $LASTEXITCODE
