#!/usr/bin/env node
'use strict'
// OpenCode launcher: a tiny always-on helper so the phone can start the opencode server on this computer.
//
// It does exactly four things, nothing else (no shell access, no file access, no arbitrary commands):
//   GET  /status    is the opencode server running and healthy?
//   POST /start     start `opencode serve` (127.0.0.1 only) if it is not running, wait until healthy
//   POST /stop      stop the server
//   POST /restart   stop, then start
//   GET/POST /pair  pairing by a short code, only while the installer has one active (see below)
// It listens on 127.0.0.1 only and is published to your private Tailscale network like the server itself.
// Every request needs the same password as the server (HTTP Basic, user "opencode"); the password is read from
// the file the installer keeps, so rotating it takes effect immediately. No dependencies: plain Node.js.
//
// Run by tools/opencode-connect.* (and at sign-in with autostart). Needs the computer to be awake and online:
// it cannot wake a sleeping machine.

const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn, execFileSync } = require('node:child_process')

const VERSION = 2
const MAX_FAILS = 6 // wrong passwords per minute per address before answering 429
// Pairing code: 6 digits shown by the installer, for when the QR code cannot be scanned. It is the only thing
// served without the password, so it is one-time, short-lived and dies after a few wrong guesses.
const PAIR_MAX_FAILS = 5
const PAIR_BODY_LIMIT = 1024

function defaultDir() {
  if (process.env.OPENCODE_CONNECT_DIR) return process.env.OPENCODE_CONNECT_DIR
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || os.homedir(), 'opencode-connect')
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode-connect')
}

function sha(value) {
  return crypto.createHash('sha256').update(String(value)).digest()
}

/** Constant-time password check (both sides hashed so lengths never leak). */
function passwordMatches(given, expected) {
  return !!expected && crypto.timingSafeEqual(sha(given), sha(expected))
}

function parseBasic(header) {
  const m = /^Basic\s+(.+)$/i.exec(header || '')
  if (!m) return null
  const decoded = Buffer.from(m[1], 'base64').toString('utf8')
  const i = decoded.indexOf(':')
  return i < 0 ? null : { user: decoded.slice(0, i), password: decoded.slice(i + 1) }
}

/**
 * The request handler, with every side effect injected so it can be tested without a real opencode.
 * deps: readPassword(), readState(), health(port, password) -> Promise<boolean>,
 *       startServer(port, password) -> void, stopServer(port) -> Promise<void>, sleep(ms) -> Promise
 */
function createLauncher(deps) {
  const fails = new Map() // address -> { count, since }
  let working = null // serialises start/stop/restart

  const portOf = () => Number((deps.readState() || {}).port) || 4096

  async function status() {
    const port = portOf()
    const password = deps.readPassword()
    const healthy = !!password && (await deps.health(port, password))
    return { running: healthy, healthy, port }
  }

  async function start() {
    const port = portOf()
    const password = deps.readPassword()
    if (!password) return { error: 'no password saved yet: run the installer once' }
    if (await deps.health(port, password)) return { running: true, healthy: true, port }
    deps.startServer(port, password)
    for (let i = 0; i < 60; i++) {
      await deps.sleep(500)
      if (await deps.health(port, password)) return { running: true, healthy: true, port }
    }
    return { running: false, healthy: false, port, error: 'the server did not become healthy in 30 s' }
  }

  async function stop() {
    await deps.stopServer(portOf())
    return status()
  }

  /** The code the installer left, if it is still usable. */
  function activePair() {
    const pair = deps.readPair ? deps.readPair() : null
    if (!pair || !/^\d{6}$/.test(String(pair.code)) || !(Number(pair.expires) > Date.now())) return null
    return pair
  }

  function readBody(req) {
    return new Promise((resolve) => {
      let text = ''
      req.on('data', (chunk) => {
        text += chunk
        if (text.length > PAIR_BODY_LIMIT) { text = ''; req.destroy() }
      })
      req.on('end', () => { try { resolve(JSON.parse(text)) } catch { resolve({}) } })
      req.on('error', () => resolve({}))
      req.on('close', () => resolve({}))
    })
  }

  /** GET: "a code is waiting here" (no secrets). POST {code}: trade the right code for the connection details. */
  async function pair(req, res) {
    const name = String((deps.readState() || {}).name || '')
    if (req.method === 'GET') {
      if (!activePair()) return send(res, 404, { ok: false, error: 'no pairing code is active' })
      return send(res, 200, { ok: true, pairing: true, name })
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'use POST' })
    const body = await readBody(req)
    // Read the code only now, so check and update happen in one step even with parallel requests.
    const current = activePair()
    if (!current) return send(res, 404, { ok: false, error: 'no pairing code is active' })
    const given = String(body && body.code !== undefined ? body.code : '').replace(/\D/g, '')
    if (!passwordMatches(given, String(current.code))) {
      const failed = (Number(current.fails) || 0) + 1
      const left = Math.max(0, PAIR_MAX_FAILS - failed)
      deps.writePair(left === 0 ? null : { ...current, fails: failed })
      return send(res, 403, { ok: false, error: 'wrong code', left })
    }
    deps.writePair(null)
    const state = deps.readState() || {}
    return send(res, 200, { ok: true, name, password: deps.readPassword(), port: portOf(), launcherPort: Number(state.launcherPort) || portOf() - 1 })
  }

  const actions = { start, stop, restart: async () => { await stop(); return start() } }

  function send(res, code, body, headers = {}) {
    const text = JSON.stringify(body)
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store', ...headers })
    res.end(text)
  }

  async function handle(req, res) {
    if ((req.url || '/').split('?')[0] === '/pair') {
      try { return await pair(req, res) } catch (error) { return send(res, 500, { ok: false, error: String(error && error.message ? error.message : error) }) }
    }
    const address = req.socket.remoteAddress || '?'
    const now = Date.now()
    const record = fails.get(address)
    if (record && now - record.since > 60_000) fails.delete(address)
    if ((fails.get(address) || { count: 0 }).count >= MAX_FAILS) return send(res, 429, { ok: false, error: 'too many attempts, wait a minute' })

    const creds = parseBasic(req.headers.authorization)
    if (!creds || creds.user !== 'opencode' || !passwordMatches(creds.password, deps.readPassword())) {
      const cur = fails.get(address) || { count: 0, since: now }
      fails.set(address, { count: cur.count + 1, since: cur.since })
      return send(res, 401, { ok: false, error: 'unauthorized' }, { 'WWW-Authenticate': 'Basic realm="opencode-launcher"' })
    }

    const route = (req.url || '/').split('?')[0]
    try {
      if (route === '/status' && req.method === 'GET') return send(res, 200, { ok: true, launcher: VERSION, server: await status() })
      const name = route.slice(1)
      if (actions[name]) {
        if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'use POST' })
        working = (working || Promise.resolve()).then(() => actions[name]()).finally(() => { working = null })
        const result = await working
        return send(res, result.error ? 500 : 200, { ok: !result.error, launcher: VERSION, server: result, ...(result.error ? { error: result.error } : {}) })
      }
      return send(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      return send(res, 500, { ok: false, error: String(error && error.message ? error.message : error) })
    }
  }

  return { handle, status, start, stop }
}

// ---------- real side effects ----------
function realDeps(dir) {
  const read = (name) => {
    try { return fs.readFileSync(path.join(dir, name), 'utf8').replace(/^﻿/, '').trim() } catch { return '' }
  }
  return {
    readPassword: () => read('password'),
    readState: () => { try { return JSON.parse(read('state.json')) } catch { return {} } },
    readPair: () => { try { return JSON.parse(read(PAIR_FILE)) } catch { return null } },
    writePair: (pair) => writePairFile(dir, pair),
    health(port, password) {
      return new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/global/health', timeout: 3000, headers: { Authorization: 'Basic ' + Buffer.from('opencode:' + password).toString('base64') } }, (res) => {
          res.resume()
          resolve(res.statusCode === 200)
        })
        req.on('error', () => resolve(false))
        req.on('timeout', () => { req.destroy(); resolve(false) })
      })
    },
    startServer(port, password, host) {
      const args = ['serve', '--hostname', host || bindHostOf(this.readState()), '--port', String(port)]
      const options = { env: { ...process.env, OPENCODE_SERVER_PASSWORD: password }, cwd: os.homedir(), detached: process.platform !== 'win32', stdio: 'ignore', windowsHide: true } // on Windows a detached cmd has no console, so opencode.exe would open its own visible window
      const child = process.platform === 'win32' ? spawn('cmd.exe', ['/c', 'opencode', ...args], options) : spawn('opencode', args, options)
      child.on('error', () => {})
      child.unref()
    },
    async stopServer(port) { stopPort(port) },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  }
}

const PAIR_FILE = 'pair.json'

/** Saves the pairing code (or removes it when given null). Only the owner may read the file. */
function writePairFile(dir, pair) {
  const file = path.join(dir, PAIR_FILE)
  try {
    if (!pair) return fs.rmSync(file, { force: true })
    fs.writeFileSync(file, JSON.stringify(pair), { mode: 0o600 })
  } catch { /* a code that cannot be saved simply does not work */ }
}

/** Kill whatever listens on a local TCP port. */
function stopPort(port) {
  for (const pid of listenerPids(port)) {
    try {
      if (process.platform === 'win32') execFileSync('taskkill.exe', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' })
      else process.kill(pid, 'SIGTERM')
    } catch { /* already gone */ }
  }
}

/** Address the server (and launcher) bind to: 127.0.0.1 unless the installer chose a LAN address. */
function bindHostOf(state) {
  const h = String((state || {}).launcherHost || '')
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) && h !== '0.0.0.0' ? h : '127.0.0.1'
}

/** Process ids listening on a local TCP port (only this port, only listeners). */
function listenerPids(port) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8' })
      return [...new Set(out.split(/\r?\n/).filter((l) => /LISTENING/i.test(l) && new RegExp(`[:.]${port}\\s`).test(l)).map((l) => Number(l.trim().split(/\s+/).pop())).filter(Boolean))]
    }
    const out = execFileSync('sh', ['-c', `lsof -ti tcp:${Number(port)} -sTCP:LISTEN 2>/dev/null || true`], { encoding: 'utf8' })
    return out.split(/\s+/).map(Number).filter(Boolean)
  } catch { return [] }
}

/** Tunnel mode: gateway on a local port + cloudflared pointed at it + telling the phone the current address. */
function startTunnelMode(dir, state, deps) {
  const { listen: listenGateway } = require('./gateway.js')
  const { startTunnel, publishUrl } = require('./tunnel.js')
  const server = Number(state.port) || 4096
  const gatewayPort = Number(state.gatewayPort) || server - 3
  listenGateway({ port: gatewayPort, ports: { server, launcher: Number(state.launcherPort) || server - 1, bridge: Number(state.bridgePort) || server - 2 } })
  let current = ''
  const remember = (url) => {
    current = url
    try {
      const file = path.join(dir, 'state.json')
      const fresh = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
      fs.writeFileSync(file, JSON.stringify({ ...fresh, tunnelUrl: url, tunnelAt: Date.now() }, null, 2))
    } catch { /* the installer rewrites the state file; the next address will be saved */ }
    publishUrl(state.tunnelTopic, url).catch(() => {})
  }
  const tunnel = startTunnel({ binary: state.cloudflared, targetPort: gatewayPort, onUrl: remember })
  setInterval(() => { if (current) publishUrl(state.tunnelTopic, current).catch(() => {}) }, 30 * 60_000).unref()
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { tunnel.stop(); process.exit(0) })
  process.on('exit', () => tunnel.stop())
}

function main() {
  const dir = defaultDir()
  const deps = realDeps(dir)
  const state = deps.readState()
  const port = Number(process.env.OPENCODE_LAUNCHER_PORT) || Number(state.launcherPort) || (Number(state.port) || 4096) - 1
  const launcher = createLauncher(deps)
  const server = http.createServer((req, res) => { launcher.handle(req, res) })
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') { console.error(`launcher already running on 127.0.0.1:${port}`); process.exit(0) }
    console.error(String(error)); process.exit(1)
  })
  const host = bindHostOf(state)
  server.listen(port, host, () => {
    console.log(`opencode launcher on ${host}:${port}`)
    // At sign-in: bring the server up too, unless the user turned that off.
    if (state.autostart !== false && deps.readPassword()) launcher.start().catch(() => {})
    if (state.mode === 'tunnel') startTunnelMode(dir, state, deps)
    // Optional: let an AI agent use a few phone functions, gated by the phone (see phone-bridge.js).
    if (state.phoneTools) require('./phone-bridge.js').listen({ port: Number(state.bridgePort) || (Number(state.port) || 4096) - 2, host, readPassword: deps.readPassword })
  })
}

module.exports = { VERSION, writePairFile, createLauncher, passwordMatches, parseBasic, listenerPids, stopPort, realDeps, bindHostOf }
if (require.main === module) main()
