#!/usr/bin/env node
'use strict'
// OpenCode Connect core (Windows, macOS, Linux). The .ps1 / .sh files only make sure Node.js exists and call this.
//
//   node connect.js [--mode tailscale|lan|local] [--port N] [--name X] [--host-name H] [--no-install] [--json]
//                   [--no-guide] [--no-open] [--no-qr] [--rotate] [--no-autostart] [--dry-run]
//                   [--doctor] [--stop] [--uninstall]
// Flags also work in PowerShell style (-Json, -NoGuide, -Mode lan). Exit codes: 0 ok, 1 failed, 2 a human must act.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const https = require('node:https')
const crypto = require('node:crypto')
const { spawn, spawnSync } = require('node:child_process')
const launcherLib = require('./launcher.js')
const autostart = require('./autostart.js')

const BASE_URL = 'https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools'
const APP_URL = 'https://github.com/jainikdroid-bit/opencode-mobile/releases/latest'
const WIN = process.platform === 'win32'
const VALUE_FLAGS = new Set(['mode', 'port', 'name', 'hostname'])
const BOOL_FLAGS = new Set(['phonetools', 'noinstall', 'json', 'noguide', 'noopen', 'noqr', 'rotate', 'noautostart', 'uninstall', 'status', 'doctor', 'stop', 'dryrun'])

/** Accepts `-Json`, `--json`, `--no-guide`, `-NoGuide`, `-Mode lan`, `--mode=lan`; case and dashes ignored. */
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    if (!/^--?[A-Za-z]/.test(raw)) continue
    const [flag, inline] = raw.replace(/^--?/, '').split('=')
    const key = flag.replace(/-/g, '').toLowerCase()
    if (VALUE_FLAGS.has(key)) out[key] = inline !== undefined ? inline : argv[++i]
    else if (BOOL_FLAGS.has(key)) out[key] = true
  }
  return out
}

function defaultDir(env = process.env) {
  if (env.OPENCODE_CONNECT_DIR) return env.OPENCODE_CONNECT_DIR
  if (WIN) return path.join(env.LOCALAPPDATA || os.homedir(), 'opencode-connect')
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode-connect')
}

function newPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.randomBytes(24), (b) => alphabet[b % alphabet.length]).join('')
}

/** opencode://connect link; the launcher port is optional. */
function buildLink({ url, password, name, launcherPort, topic }) {
  const e = encodeURIComponent
  return `opencode://connect?url=${e(url)}&password=${e(password)}&name=${e(name)}${launcherPort ? `&launcher=${launcherPort}` : ''}${topic ? `&topic=${e(topic)}` : ''}`
}

/** First private IPv4 address of a non-internal interface. */
function lanIp(interfaces = os.networkInterfaces()) {
  for (const list of Object.values(interfaces)) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) return a.address
  }
  return null
}

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, shell: false, ...opts })

function which(name, extra = []) {
  const r = WIN ? sh('where.exe', [name]) : sh('sh', ['-c', `command -v ${name}`])
  const first = r.status === 0 ? String(r.stdout).split(/\r?\n/).find(Boolean) : null
  if (first) return first.trim()
  return extra.find((p) => p && fs.existsSync(p)) || null
}

function findTailscale() {
  return which(WIN ? 'tailscale.exe' : 'tailscale', [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Tailscale', 'tailscale.exe'),
    '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
  ])
}
const findOpencode = () => which('opencode', [path.join(process.env.APPDATA || '', 'npm', 'opencode.cmd'), path.join(os.homedir(), '.opencode', 'bin', 'opencode')])
const npmCmd = () => (WIN ? 'npm.cmd' : 'npm')

function run(opts, io) {
  const dir = defaultDir()
  const pwFile = path.join(dir, 'password')
  const stateFile = path.join(dir, 'state.json')
  const steps = []
  const result = { ok: false, stage: 'start', needs: null, message: '', appUrl: APP_URL, steps }

  const say = (text) => (opts.json ? io.err(text) : io.out(text))
  const note = (step, state, detail = '') => {
    steps.push({ step, state, detail })
    const mark = { ok: '[ok]', did: '[+] ', skip: '[-] ', need: '[!] ' }[state] || '[x] '
    say(`${mark} ${step} ${detail}`.trimEnd())
  }
  const finish = (code) => {
    if (opts.json) io.out(JSON.stringify(result))
    return code
  }
  const fail = (stage, message) => { result.stage = stage; result.message = message; note(stage, 'fail', message); return finish(1) }
  const need = (what, message, extra = {}) => { result.stage = what; result.needs = what; result.message = message; Object.assign(result, extra); note(what, 'need', message); return finish(2) }

  const readFile = (f) => { try { return fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim() } catch { return '' } }
  let state = {}
  try { state = JSON.parse(readFile(stateFile)) } catch { state = {} }
  const mode = opts.mode || state.mode || 'tailscale'
  if (!['tailscale', 'lan', 'local', 'tunnel'].includes(mode)) return fail('args', `unknown mode "${mode}" (use tailscale, lan, local or tunnel)`)
  let port = Number(opts.port || state.port || 4096)
  const name = opts.name || state.name || os.hostname()
  result.mode = mode

  const guideTotal = mode === 'tailscale' ? 4 : 3
  let guideN = 0
  const guide = (title, what, you) => {
    guideN++
    if (opts.json || opts.noguide || opts.dryrun) return
    io.out(`\nStep ${guideN}/${guideTotal}: ${title}\n  ${what}\n  You: ${you}`)
  }

  const health = (p, password, host = '127.0.0.1') => new Promise((resolve) => {
    const req = http.get({ host, port: p, path: '/global/health', timeout: 4000, headers: { Authorization: 'Basic ' + Buffer.from('opencode:' + password).toString('base64') } }, (res) => { res.resume(); resolve(res.statusCode === 200) })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const listening = (p) => launcherLib.listenerPids(p).length > 0

  return (async () => {
    fs.mkdirSync(dir, { recursive: true })
    const launcherPortOf = () => Number(state.launcherPort) || port - 1
    const ts = findTailscale()

    // ----- uninstall -----
    if (opts.uninstall) {
      const bridgeP = Number(state.bridgePort) || port - 2
      for (const p of [port, launcherPortOf()]) launcherLib.stopPort(p)
      note('server and launcher', 'did', 'stopped')
      if (ts && mode === 'tailscale') { for (const p of [port, launcherPortOf(), bridgeP]) sh(ts, ['serve', `--tcp=${p}`, 'off']); note('tailscale forwards', 'did', 'removed') }
      if (unregisterOpencodeMcp()) note('phone tools', 'did', 'removed the MCP entry from the opencode config')
      const gone = autostart.remove()
      if (gone.length) note('autostart', 'did', 'removed')
      result.ok = true; result.stage = 'uninstalled'
      say(`Your settings and password stay in ${dir} (delete that folder to remove them too).`)
      return finish(0)
    }

    // ----- stop -----
    if (opts.stop) {
      if (listening(port)) { launcherLib.stopPort(port); note('server', 'did', `stopped (port ${port}); the launcher stays so the phone can start it again`) } else note('server', 'skip', 'was not running')
      if (ts && mode === 'tailscale') { sh(ts, ['serve', `--tcp=${port}`, 'off']); note('tailscale forward', 'did', `removed tcp/${port}`) }
      result.ok = true; result.stage = 'stopped'
      return finish(0)
    }

    // ----- doctor / status (read-only) -----
    if (opts.doctor || opts.status) {
      const pw = readFile(pwFile)
      let tsState = null, tsIp = null
      if (ts) {
        try { tsState = JSON.parse(sh(ts, ['status', '--json']).stdout).BackendState } catch { tsState = 'unknown' }
        tsIp = (sh(ts, ['ip', '-4']).stdout || '').split(/\r?\n/)[0] || null
      }
      const isUp = listening(port)
      result.doctor = {
        node: true, opencode: !!findOpencode(), tailscaleInstalled: !!ts, tailscaleState: tsState, tailscaleIp: tsIp,
        launcherListening: listening(launcherPortOf()), passwordSaved: !!pw, port, serverListening: isUp,
        serverHealthy: !!(pw && isUp && (await health(port, pw))), platform: process.platform, ...(mode === 'tunnel' ? { tunnelUrl: state.tunnelUrl || null } : {}),
      }
      for (const [k, v] of Object.entries(result.doctor)) say(`  ${k.padEnd(20)} ${v}`)
      result.ok = true; result.stage = 'doctor'
      return finish(0)
    }

    say('\nOpenCode Connect')
    say(`Mode: ${mode}${opts.dryrun ? '  (dry run: nothing will be changed)' : ''}\n`)

    // ----- 1. opencode -----
    guide('Prepare this computer', 'Installs opencode if it is missing (silent).', 'nothing, or approve a permission prompt if your system asks')
    note('node', 'ok', process.version)
    if (!findOpencode()) {
      if (opts.dryrun) note('opencode', 'need', 'would run: npm install -g opencode-ai')
      else {
        if (opts.noinstall) return fail('opencode', 'opencode is missing and --no-install was given.')
        say('Installing opencode (npm)...')
        sh(npmCmd(), ['install', '-g', 'opencode-ai', '--no-audit', '--no-fund', '--silent'], { shell: WIN })
        if (!findOpencode()) return fail('opencode', 'npm install -g opencode-ai failed (on Linux/macOS it may need a user-level npm prefix). Run it manually and try again.')
        note('opencode', 'did', 'installed')
      }
    } else note('opencode', 'ok')

    // ----- 2. Tailscale -----
    if (mode === 'tailscale') guide('Private link (Tailscale)', 'Installs Tailscale if needed. It connects your phone and this computer privately, from anywhere.', 'sign in once in the page that opens (Google / Microsoft / GitHub)')
    let tsExe = ts
    let tsIp = null
    if (mode === 'tailscale') {
      if (!tsExe) {
        if (opts.dryrun) note('tailscale', 'need', 'would install Tailscale')
        else {
          if (opts.noinstall) return fail('tailscale', 'Tailscale is missing and --no-install was given.')
          const installed = installTailscale(say)
          tsExe = installed ? findTailscale() : null
          if (!tsExe) return need('install-tailscale', 'Install Tailscale from https://tailscale.com/download and run this again.')
          note('tailscale', 'did', 'installed')
        }
      } else note('tailscale', 'ok')

      if (tsExe && opts.dryrun) tsIp = (sh(tsExe, ['ip', '-4']).stdout || '').split(/\r?\n/)[0] || null
      if (tsExe && !opts.dryrun) {
        const status = () => { try { return JSON.parse(sh(tsExe, ['status', '--json']).stdout) } catch { return null } }
        let st = status()
        if (!st || st.BackendState !== 'Running') {
          say('Tailscale needs you to sign in (once). Pick Google / Microsoft / GitHub in the page that opens.')
          spawn(tsExe, ['up'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
          let authUrl = null
          for (const deadline = Date.now() + 240_000; Date.now() < deadline;) {
            await sleep(2000)
            st = status()
            if (st && st.BackendState === 'Running') break
            if (st && st.AuthURL && !authUrl) {
              authUrl = String(st.AuthURL)
              if (opts.json || opts.noopen) return need('tailscale_login', 'Open this link, sign in to Tailscale, then run the command again.', { authUrl })
              say(`Sign-in page: ${authUrl}`)
              openExternal(authUrl)
            }
          }
          if (!st || st.BackendState !== 'Running') return need('tailscale_login', 'Tailscale sign-in was not finished in time. Run this command again after signing in.', { authUrl })
          note('tailscale sign-in', 'did')
        } else note('tailscale sign-in', 'ok')
        tsIp = (sh(tsExe, ['ip', '-4']).stdout || '').split(/\r?\n/)[0] || null
        if (!tsIp) return fail('tailscale', 'Tailscale has no IPv4 address.')
      }
    }

    // ----- 3. host, password -----
    let bindHost = '127.0.0.1'
    let linkHost = '127.0.0.1'
    if (mode === 'tailscale') linkHost = tsIp || '<tailscale-ip>'
    if (mode === 'lan') {
      const lan = lanIp()
      if (!lan) return fail('lan', 'No LAN address found.')
      bindHost = lan; linkHost = lan
    }
    if (opts.hostname) linkHost = opts.hostname
    let cloudflared = null
    if (mode === 'tunnel' && !opts.dryrun) {
      if (opts.noinstall && !fs.existsSync(path.join(dir, WIN ? 'cloudflared.exe' : 'cloudflared')) && !which(WIN ? 'cloudflared.exe' : 'cloudflared')) return fail('cloudflared', 'cloudflared is missing and --no-install was given.')
      cloudflared = await ensureCloudflared(dir, say)
      if (!cloudflared) return need('install-cloudflared', 'Install cloudflared from https://github.com/cloudflare/cloudflared/releases and run this again.')
      note('cloudflared', 'ok', cloudflared)
    }

    if (opts.dryrun) {
      say(`\nWould start: opencode serve --hostname ${bindHost} --port ${port}`)
      if (mode === 'tailscale') say(`Would run: tailscale serve --bg --tcp ${port} tcp://127.0.0.1:${port}`)
      if (mode === 'tunnel') say('Would start a free Cloudflare quick tunnel (outbound only) to a local gateway; the address is sent to the phone through a private ntfy.sh topic.')
      say(`Phone would connect to: http://${linkHost}:${port}`)
      result.ok = true; result.stage = 'dry-run'
      return finish(0)
    }

    let password = opts.rotate ? '' : readFile(pwFile)
    if (!password) {
      password = newPassword()
      fs.writeFileSync(pwFile, password, { mode: 0o600 })
      if (WIN) sh('icacls.exe', [pwFile, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:(R,W)`])
      note('password', 'did', 'created (kept in your profile, pairing stays valid across restarts)')
    } else note('password', 'ok')

    // ----- 4. server -----
    guide('Start the server', 'Runs opencode on this computer, reachable only by you.', 'nothing')
    const deps = launcherLib.realDeps(dir)
    if (listening(port) && (await health(port, password, bindHost))) note('server', 'ok', `already running on port ${port}`)
    else {
      if (listening(port)) {
        for (let p = port + 1; p <= port + 20; p++) if (!listening(p)) { port = p; break }
        note('port', 'did', `busy, using ${port}`)
      }
      deps.startServer(port, password, bindHost)
      let up = false
      for (let i = 0; i < 40 && !up; i++) { await sleep(500); up = await health(port, password, bindHost) }
      if (!up) return fail('server', 'opencode serve did not become healthy in 20 s. Run "opencode serve" in a terminal to see why.')
      note('server', 'did', `started on ${bindHost}:${port}`)
    }
    const launcherPort = port - 1
    const bridgePort = port - 2
    const phoneToolsWasOn = !!state.phoneTools
    const tunnelWasOn = state.mode === 'tunnel' && !!state.tunnelUrl
    const phoneTools = !!(opts.phonetools || state.phoneTools)
    const autostartOn = !opts.noautostart && mode !== 'local'
    const launcherAlive = listening(launcherPort)
    const tunnelOn = mode === 'tunnel'
    const tunnelTopic = tunnelOn ? state.tunnelTopic || `ocx-${crypto.randomBytes(12).toString('hex')}` : undefined
    state = {
      port, mode, name, launcherPort, launcherHost: bindHost, autostart: autostartOn, phoneTools, ...(phoneTools ? { bridgePort } : {}),
      ...(tunnelOn ? { gatewayPort: port - 3, bridgePort, tunnelTopic, cloudflared, ...(launcherAlive && state.tunnelUrl ? { tunnelUrl: state.tunnelUrl } : {}) } : {}),
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))

    // ----- 4b. launcher: lets the phone start the server later -----
    const launcherJs = path.join(dir, 'launcher.js')
    const bundled = path.join(__dirname, 'launcher.js')
    if (path.resolve(bundled) !== path.resolve(launcherJs) && fs.existsSync(bundled)) fs.copyFileSync(bundled, launcherJs)
    for (const extra of [...(phoneTools ? ['phone-bridge.js', 'phone-mcp.js'] : []), ...(mode === 'tunnel' ? ['gateway.js', 'tunnel.js'] : [])]) {
      const src = path.join(__dirname, extra)
      const dest = path.join(dir, extra)
      if (path.resolve(src) !== path.resolve(dest) && fs.existsSync(src)) fs.copyFileSync(src, dest)
    }
    if (phoneTools && !phoneToolsWasOn) launcherLib.stopPort(launcherPort) // restart so the launcher starts the bridge
    if (mode === 'tunnel' && !tunnelWasOn && listening(launcherPort)) launcherLib.stopPort(launcherPort) // restart into tunnel mode
    if (!fs.existsSync(launcherJs)) { try { fs.writeFileSync(launcherJs, await download(`${BASE_URL}/launcher.js`)) } catch { /* reported below */ } }
    if (!fs.existsSync(launcherJs)) note('launcher', 'skip', 'could not fetch launcher.js (starting the server from the phone will not work)')
    else {
      if (!listening(launcherPort)) {
        spawn(process.execPath, [launcherJs], { env: { ...process.env, OPENCODE_CONNECT_DIR: dir }, detached: true, stdio: 'ignore', windowsHide: true }).unref()
        for (let i = 0; i < 20 && !listening(launcherPort); i++) await sleep(250)
      }
      if (listening(launcherPort)) {
        note('launcher', 'ok', `phone can start the server (port ${launcherPort})`)
        if (mode === 'tailscale') sh(tsExe, ['serve', '--bg', '--tcp', String(launcherPort), `tcp://127.0.0.1:${launcherPort}`])
        if (phoneTools) {
          for (let i = 0; i < 20 && !listening(bridgePort); i++) await sleep(250)
          if (mode === 'tailscale') sh(tsExe, ['serve', '--bg', '--tcp', String(bridgePort), `tcp://127.0.0.1:${bridgePort}`])
          note('phone tools', listening(bridgePort) ? 'ok' : 'skip', listening(bridgePort) ? registerOpencodeMcp(path.join(dir, 'phone-mcp.js')) : 'bridge did not start')
        }
      } else note('launcher', 'skip', 'did not start')
      if (autostartOn) {
        try { note('autostart', 'did', `launcher starts when you sign in (${autostart.install({ nodePath: process.execPath, launcherPath: launcherJs, dir })}; opt out: --no-autostart)`) } catch (e) { note('autostart', 'skip', String(e.message || e)) }
      }
    }

    // ----- 5. publish -----
    if (mode === 'tailscale') { sh(tsExe, ['serve', '--bg', '--tcp', String(port), `tcp://127.0.0.1:${port}`]); note('tailscale forward', 'ok', `tcp/${port} inside your tailnet only`) }
    else if (mode === 'lan') say('LAN mode: every device on this network can reach the server (password protected). If your firewall asks, allow it.')

    // ----- 6. pairing link and QR -----
    guide('Pair your phone', 'Shows two QR codes: one to get the app, one to connect.', 'about 3 taps on the phone (see below)')
    if (!opts.json && !opts.noguide) {
      io.out(`\nOn your phone:\n  1. Install the app: open ${APP_URL} and download the APK (the page on this computer has a QR for it).`)
      if (mode === 'tailscale') io.out('  2. Install Tailscale from Google Play and sign in with the same account.')
      io.out(`  ${mode === 'tailscale' ? 3 : 2}. Open the app, tap 'Scan QR to pair', point the camera at the QR code, tap Connect.`)
    }
    let serverUrl = `http://${linkHost}:${port}`
    if (mode === 'tunnel') {
      say('Waiting for the tunnel address (up to 60 s)...')
      for (let i = 0; i < 120 && !currentTunnelUrl(stateFile); i++) await sleep(500)
      serverUrl = currentTunnelUrl(stateFile)
      if (!serverUrl) return fail('tunnel', 'The tunnel did not come up. Check that this computer can reach the internet and run again.')
      note('tunnel', 'ok', serverUrl)
      say('Tunnel mode: the address is public but needs the long password, and repeated wrong guesses are blocked. Do not share the pairing link.')
    }
    const link = buildLink({ url: serverUrl, password, name, launcherPort, topic: mode === 'tunnel' ? state.tunnelTopic : undefined })
    Object.assign(result, { serverUrl, pairingLink: link, launcherPort, ok: true, stage: 'ready', message: 'Install the app on the phone, then scan the pairing QR or open the pairing link on the phone.' })

    if (!opts.noqr) await showQr({ dir, link, opts, io, say })
    if (!opts.json) io.out(`\nPairing link (also works with "Paste pairing link" in the app):\n${link}\n\nStop later:  --stop     Check:  --doctor     Remove:  --uninstall`)
    return finish(0)
  })()
}

/** Adds the phone MCP server to the user's opencode config (merging, never overwriting other entries). */
const opencodeConfigFile = () => path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode', 'opencode.json')

function registerOpencodeMcp(mcpPath) {
  const file = opencodeConfigFile()
  const entry = { type: 'local', command: ['node', mcpPath], enabled: true }
  let config = {}
  try {
    if (fs.existsSync(file)) config = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))
  } catch {
    return `add this to ${file} yourself ("mcp": { "phone": ${JSON.stringify(entry)} }): the file could not be parsed`
  }
  const next = { ...config, mcp: { ...(config.mcp || {}), phone: entry } }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(next, null, 2))
  return `agent can use the phone (MCP "phone" added to ${file}); the phone app decides what is allowed`
}

/** Removes only the "phone" entry we added. Returns true if something was removed. */
function unregisterOpencodeMcp() {
  const file = opencodeConfigFile()
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))
    if (!config.mcp || !config.mcp.phone) return false
    const { phone, ...rest } = config.mcp
    fs.writeFileSync(file, JSON.stringify({ ...config, mcp: rest }, null, 2))
    return true
  } catch { return false }
}

/** cloudflared for tunnel mode: use the one on PATH, else download the single binary next to our state (no admin rights). */
async function ensureCloudflared(dir, say) {
  const own = path.join(dir, WIN ? 'cloudflared.exe' : 'cloudflared')
  const found = which(WIN ? 'cloudflared.exe' : 'cloudflared')
  if (found) return found
  if (fs.existsSync(own)) return own
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  if (process.platform === 'darwin') {
    const brew = which('brew')
    if (brew) { say('Installing cloudflared (Homebrew)...'); sh(brew, ['install', 'cloudflared']) }
    return which('cloudflared')
  }
  const asset = WIN ? `cloudflared-windows-${arch}.exe` : `cloudflared-linux-${arch}`
  say('Downloading cloudflared (free tunnel client, about 40 MB)...')
  try {
    fs.writeFileSync(own, await download(`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`), { mode: 0o755 })
    return own
  } catch { return null }
}

function currentTunnelUrl(stateFile) {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8').replace(/^\uFEFF/, '')).tunnelUrl || '' } catch { return '' }
}

function installTailscale(say) {
  say('Installing Tailscale (your system may ask for permission)...')
  if (WIN) {
    const w = which('winget.exe')
    if (!w) return false
    sh(w, ['install', '-e', '--id', 'Tailscale.Tailscale', '--silent', '--accept-package-agreements', '--accept-source-agreements'])
    return true
  }
  if (process.platform === 'darwin') {
    const brew = which('brew')
    if (!brew) return false
    return sh(brew, ['install', '--cask', 'tailscale']).status === 0
  }
  return sh('sh', ['-c', 'curl -fsSL https://tailscale.com/install.sh | sh'], { stdio: 'inherit' }).status === 0
}

function openExternal(target) {
  try {
    if (WIN) spawn('cmd.exe', ['/c', 'start', '', target.replace(/&/g, '^&')], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
  } catch { /* no browser available */ }
}

function download(url, hops = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 5) { res.resume(); return resolve(download(new URL(res.headers.location, url).toString(), hops + 1)) }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)) }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

async function showQr({ dir, link, opts, io, say }) {
  if (!fs.existsSync(path.join(dir, 'node_modules', 'qrcode'))) sh(npmCmd(), ['install', '--prefix', dir, 'qrcode', 'qrcode-terminal', '--no-audit', '--no-fund', '--silent'], { shell: WIN })
  let QR, term
  try { const req = require('node:module').createRequire(path.join(dir, 'x.js')); QR = req('qrcode'); term = req('qrcode-terminal') } catch { return say('(QR codes unavailable: could not install the QR helper. Use the link below.)') }
  if (!opts.json) { io.out('\nPoint the phone at this code (app: Scan QR to pair):'); term.generate(link, { small: true }, (q) => io.out(q)) }
  if (opts.noopen) return
  const [pair, app] = await Promise.all([QR.toDataURL(link, { margin: 2, width: 440 }), QR.toDataURL(APP_URL, { margin: 2, width: 260 })])
  const html = '<!doctype html><meta charset="utf-8"><title>OpenCode: pair your phone</title>' +
    '<body style="margin:0;background:#07080c;color:#e8ecf4;font-family:Consolas,monospace;text-align:center;padding:32px">' +
    '<h2 style="color:#22d3ee;letter-spacing:2px">OPENCODE CONNECT</h2>' +
    `<p>1. Install the app on the phone (skip if you already have it)</p><img src="${app}" width="200" style="background:#fff;border-radius:8px"><br>` +
    '<p>2. Install Tailscale on the phone (Google Play) and sign in with the same account. Skip in LAN mode.</p>' +
    `<p>3. Open the OpenCode app, tap Scan QR to pair, point it at this code, tap Connect</p><img src="${pair}" width="360" style="background:#fff;border-radius:8px">` +
    '<p style="color:#8a93a8;font-size:12px">This page holds your pairing password and deletes itself in 5 minutes.</p></body>'
  const page = path.join(os.tmpdir(), 'opencode-pair.html')
  fs.writeFileSync(page, html, { mode: 0o600 })
  openExternal(page)
  setTimeout(() => fs.rmSync(page, { force: true }), 300_000).unref()
  // a detached helper removes it even though this process exits first
  spawn(process.execPath, ['-e', `setTimeout(()=>{try{require('fs').rmSync(${JSON.stringify(page)},{force:true})}catch(e){}},300000)`], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

module.exports = { currentTunnelUrl, registerOpencodeMcp, unregisterOpencodeMcp, parseArgs, defaultDir, newPassword, buildLink, lanIp, run }

if (require.main === module) {
  const io = { out: (t) => process.stdout.write(t + '\n'), err: (t) => process.stderr.write(t + '\n') }
  run(parseArgs(process.argv.slice(2)), io).then((code) => process.exit(code), (e) => { console.error(String(e && e.stack ? e.stack : e)); process.exit(1) })
}
