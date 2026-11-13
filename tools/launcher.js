#!/usr/bin/env node
'use strict'
// OpenCode launcher: a tiny always-on helper so the phone can start the opencode server on this computer.
//
// It does exactly four things, nothing else (no shell access, no file access, no arbitrary commands), plus one bridge:
//   GET  /status    is the opencode server running and healthy?
//   POST /start     start `opencode serve` (127.0.0.1 only) if it is not running, wait until healthy
//   POST /stop      stop the server
//   POST /restart   stop, then start
//   GET/POST /pair  pairing by a short code, only while the installer has one active (see below)
//   /acp/...        other coding agents through the Agent Client Protocol (see acp-bridge.js)
//   GET  /hello     proof of identity for a phone at home (a hash of a phone nonce and the password; no secrets)
// It listens on 127.0.0.1 only and is published to your private Tailscale network like the server itself.
// With "lanForward" on (Tailscale mode), it also mirrors the server, itself and the phone bridge onto this
// computer's home-network addresses, so a phone at home connects directly, without Tailscale or a VPN.
// Every request needs the same password as the server (HTTP Basic, user "opencode"); the password is read from
// the file the installer keeps, so rotating it takes effect immediately. No dependencies: plain Node.js.
//
// Run by tools/opencode-connect.* (and at sign-in with autostart). Needs the computer to be awake and online:
// it cannot wake a sleeping machine.

const http = require('node:http')
const net = require('node:net')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn, execFileSync } = require('node:child_process')

const VERSION = 4 // 4: /acp/ (other agents through the Agent Client Protocol)
const LAN_RESCAN_MS = 30_000
const PRIVATE_V4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
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
 *       startServer(port, password) -> void, stopServer(port) -> Promise<void>, sleep(ms) -> Promise,
 *       lanHost() -> string (optional: this computer's home-network address, '' when none)
 */
function createLauncher(deps) {
  const fails = new Map() // address -> { count, since }
  let working = null // serialises start/stop/restart

  const portOf = () => Number((deps.readState() || {}).port) || 4096
  /** Where the phone reaches this computer: the address from the pairing link, plus the home-network one when mirrored. */
  function addresses(state) {
    const host = /^[A-Za-z0-9.:-]{1,253}$/.test(String(state.linkHost || '')) ? String(state.linkHost) : ''
    const lan = state.lanForward && deps.lanHost ? deps.lanHost() : ''
    return { ...(host ? { host } : {}), ...(lan ? { lan } : {}) }
  }

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
    return send(res, 200, { ok: true, name, password: deps.readPassword(), port: portOf(), launcherPort: Number(state.launcherPort) || portOf() - 1, ...addresses(state) })
  }

  const actions = { start, stop, restart: async () => { await stop(); return start() } }

  function send(res, code, body, headers = {}) {
    const text = JSON.stringify(body)
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store', ...headers })
    res.end(text)
  }

  /**
   * GET /hello?n=<nonce>: proves this is the computer the phone paired with, without sending the password.
   * The phone checks the proof before it sends anything with the password to a home-network address,
   * because another network can have a different device on the same address.
   */
  function hello(req, res) {
    const nonce = new URL(req.url || '/', 'http://x').searchParams.get('n') || ''
    const password = deps.readPassword()
    if (!/^[A-Za-z0-9]{16,64}$/.test(nonce) || !password) return send(res, 400, { ok: false, error: 'bad nonce' })
    return send(res, 200, { ok: true, proof: helloProof(nonce, password) })
  }

  async function handle(req, res) {
    if ((req.url || '/').split('?')[0] === '/pair') {
      try { return await pair(req, res) } catch (error) { return send(res, 500, { ok: false, error: String(error && error.message ? error.message : error) }) }
    }
    if ((req.url || '/').split('?')[0] === '/hello' && req.method === 'GET') return hello(req, res)
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
    // Other coding agents (ACP): the bridge answers its own routes, once the password has been checked above.
    if (route.startsWith('/acp/') && deps.acp) { await deps.acp.handle(req, res, route); return }
    try {
      if (route === '/status' && req.method === 'GET') return send(res, 200, { ok: true, launcher: VERSION, acp: !!deps.acp, server: await status(), ...addresses(deps.readState() || {}) })
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
/** sha256("<nonce>:<password>") in hex: the phone computes the same and compares (see src/lib/lan-route.ts). */
function helloProof(nonce, password) {
  return crypto.createHash('sha256').update(`${nonce}:${password}`).digest('hex')
}

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
    async stopServer(port) { stopPort(port, bindHostOf(this.readState())) },
    lanHost: () => lanAddresses()[0] || '',
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
function stopPort(port, bindHost) {
  for (const pid of listenerPids(port, bindHost)) {
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

// Listeners that are "this computer's" server or launcher: loopback, any-address, or the LAN-mode bind host.
// Tailscale's own forward (100.x) and the launcher's LAN mirrors are someone else's: never counted or killed.
const LOCAL_HOSTS = new Set(['127.0.0.1', '0.0.0.0', '::1', '::', '*'])

/** Process ids listening on a local TCP port (only this port, only listeners on a local address, never this process). */
function listenerPids(port, bindHost) {
  const hosts = new Set([...LOCAL_HOSTS, ...(bindHost ? [bindHost] : [])])
  const mine = (host) => hosts.has(host.replace(/^\[|\]$/g, ''))
  try {
    let found = []
    if (process.platform === 'win32') {
      const out = execFileSync('netstat.exe', ['-ano'], { encoding: 'utf8' })
      for (const line of out.split(/\r?\n/)) {
        const cols = line.trim().split(/\s+/)
        if (cols.length < 5 || !/^TCP/i.test(cols[0]) || !/LISTEN/i.test(cols[3])) continue
        const at = cols[1].lastIndexOf(':')
        if (Number(cols[1].slice(at + 1)) === Number(port) && mine(cols[1].slice(0, at))) found.push(Number(cols[4]))
      }
    } else {
      const out = execFileSync('sh', ['-c', `lsof -nP -iTCP:${Number(port)} -sTCP:LISTEN -Fpn 2>/dev/null || true`], { encoding: 'utf8' })
      let pid = 0
      for (const line of out.split(/\n/)) {
        if (line.startsWith('p')) pid = Number(line.slice(1))
        else if (line.startsWith('n')) { const at = line.lastIndexOf(':'); if (mine(line.slice(1, at))) found.push(pid) }
      }
    }
    return [...new Set(found.filter((pid) => pid && pid !== process.pid))]
  } catch { return [] }
}

/** Private IPv4 addresses of this computer's real network links, best first (192.168, 10, 172). VPN links (/32) are skipped. */
function lanAddresses(interfaces = os.networkInterfaces()) {
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2)
  const out = []
  for (const list of Object.values(interfaces || {})) {
    for (const a of list || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal || a.netmask === '255.255.255.255') continue
      if (PRIVATE_V4.test(a.address) && !out.includes(a.address)) out.push(a.address)
    }
  }
  return out.sort((x, y) => rank(x) - rank(y))
}

/**
 * Mirror local ports onto the home-network addresses (plain TCP, nothing is read or changed), so a phone at
 * home reaches the server without Tailscale. Addresses are re-read every 30 s: a laptop moves between networks.
 */
function startLanForward(ports, { addresses = () => lanAddresses(), target = '127.0.0.1', rescanMs = LAN_RESCAN_MS } = {}) {
  const servers = new Map() // "ip port" -> net.Server
  const scan = () => {
    const current = new Set(addresses())
    for (const [key, server] of servers) if (!current.has(key.split(' ')[0])) { server.close(); servers.delete(key) }
    for (const ip of current) {
      for (const port of ports) {
        const key = `${ip} ${port}`
        if (servers.has(key)) continue
        // Half-open allowed on both ends: a client that finishes sending still gets the whole answer.
        const server = net.createServer({ allowHalfOpen: true }, (socket) => {
          const upstream = net.connect({ port, host: target, allowHalfOpen: true })
          const end = () => { socket.destroy(); upstream.destroy() }
          socket.on('error', end)
          upstream.on('error', end)
          socket.pipe(upstream).pipe(socket)
        })
        server.on('error', () => { servers.delete(key) }) // address gone or port taken: tried again on the next scan
        server.listen(port, ip)
        servers.set(key, server)
      }
    }
  }
  scan()
  const timer = setInterval(scan, rescanMs)
  timer.unref()
  return {
    listening: () => [...servers.keys()],
    close() { clearInterval(timer); for (const server of servers.values()) server.close(); servers.clear() },
  }
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
  try { deps.acp = require('./acp-bridge.js').createAcpBridge() } catch { /* an older install without the file: no other agents */ }
  if (deps.acp) process.on('exit', () => deps.acp.stopAll())
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
    // Home network: the same ports on this computer's LAN addresses (Tailscale mode only; the server stays on 127.0.0.1).
    if (state.lanForward && host === '127.0.0.1') {
      const server = Number(state.port) || 4096
      startLanForward([server, port, ...(state.phoneTools ? [Number(state.bridgePort) || server - 2] : [])])
    }
  })
}

module.exports = { VERSION, writePairFile, createLauncher, passwordMatches, parseBasic, listenerPids, stopPort, realDeps, bindHostOf, lanAddresses, startLanForward, helloProof }
if (require.main === module) main()
