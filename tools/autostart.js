'use strict'
// Hidden autostart for the launcher on Windows, macOS and Linux. The launcher (tools/launcher.js) then starts the
// opencode server at sign-in and stays up so the phone can start it later.
//
//   Windows  a .vbs in the Startup folder (runs node with no window)
//   macOS    a LaunchAgent (~/Library/LaunchAgents/com.opencode.connect.plist)
//   Linux    a systemd user service; where systemd is not available, an XDG autostart entry
//
// The builders return plain strings so they can be unit-tested on any OS; install()/remove() do the file work.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const LABEL = 'com.opencode.connect'

function startupFolder(env = process.env) {
  return path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
}

/** VBScript that starts `node launcher.js` with no console window. */
function windowsVbs(nodePath, launcherPath) {
  const q = (s) => s.replace(/"/g, '""')
  return `CreateObject("WScript.Shell").Run """${q(nodePath)}"" ""${q(launcherPath)}""", 0, False\r\n`
}

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function macPlist(nodePath, launcherPath, logPath) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${xmlEscape(nodePath)}</string><string>${xmlEscape(launcherPath)}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key><string>${xmlEscape(logPath)}</string>
</dict>
</plist>
`
}

function systemdUnit(nodePath, launcherPath) {
  const quote = (s) => `"${s.replace(/"/g, '\\"')}"`
  return `[Unit]
Description=OpenCode launcher (lets the phone start the opencode server)
After=network-online.target

[Service]
ExecStart=${quote(nodePath)} ${quote(launcherPath)}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`
}

function xdgDesktop(nodePath, launcherPath) {
  const quote = (s) => `"${s.replace(/(["\\`$])/g, '\\$1')}"`
  return `[Desktop Entry]
Type=Application
Name=OpenCode launcher
Exec=${quote(nodePath)} ${quote(launcherPath)}
X-GNOME-Autostart-enabled=true
NoDisplay=true
`
}

/** Where each OS keeps its autostart file. */
function targets(platform = process.platform, home = os.homedir(), env = process.env) {
  if (platform === 'win32') return { kind: 'windows', file: path.join(startupFolder(env), 'opencode-connect.vbs') }
  if (platform === 'darwin') return { kind: 'mac', file: path.join(home, 'Library', 'LaunchAgents', `${LABEL}.plist`) }
  return {
    kind: 'linux',
    unit: path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'systemd', 'user', 'opencode-connect.service'),
    desktop: path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'autostart', 'opencode-connect.desktop'),
  }
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'ignore' }).status

/** Register the launcher to start at sign-in. Returns a short description of what was done, or throws. */
function install({ nodePath, launcherPath, dir }) {
  const t = targets()
  if (t.kind === 'windows') {
    write(t.file, windowsVbs(nodePath, launcherPath))
    return `Startup folder entry ${t.file}`
  }
  if (t.kind === 'mac') {
    write(t.file, macPlist(nodePath, launcherPath, path.join(dir, 'launcher.log')))
    run('launchctl', ['unload', t.file])
    run('launchctl', ['load', '-w', t.file])
    return `LaunchAgent ${t.file}`
  }
  // Linux: prefer a systemd user service, fall back to an XDG autostart entry
  write(t.unit, systemdUnit(nodePath, launcherPath))
  if (run('systemctl', ['--user', 'daemon-reload']) === 0 && run('systemctl', ['--user', 'enable', '--now', 'opencode-connect.service']) === 0) {
    return `systemd user service ${t.unit}`
  }
  fs.rmSync(t.unit, { force: true })
  write(t.desktop, xdgDesktop(nodePath, launcherPath))
  return `autostart entry ${t.desktop}`
}

/** Undo install(). Safe to call when nothing was installed. */
function remove() {
  const t = targets()
  const gone = []
  const rm = (f) => { if (f && fs.existsSync(f)) { fs.rmSync(f, { force: true }); gone.push(f) } }
  if (t.kind === 'mac') run('launchctl', ['unload', t.file])
  if (t.kind === 'linux') { run('systemctl', ['--user', 'disable', '--now', 'opencode-connect.service']); rm(t.unit); rm(t.desktop) } else rm(t.file)
  return gone
}

module.exports = { LABEL, windowsVbs, macPlist, systemdUnit, xdgDesktop, targets, install, remove, startupFolder }
