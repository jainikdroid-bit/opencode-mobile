'use strict'
// Phone bridge: lets an AI agent on this computer use a few phone functions, with the phone as the gatekeeper.
//
//   agent (via tools/phone-mcp.js) --POST /call--> bridge --held until the phone polls--> phone app
//   phone app: GET /poll (long poll) -> runs the tool if the user allows it -> POST /result
//
// The bridge never executes anything itself and never stores results; it is a mailbox. The phone decides per tool
// (settings switches, optional per-call confirmation) and works only while the app is open.
// Same password as the server (HTTP Basic, user "opencode"), 127.0.0.1 only, published inside the tailnet.

const http = require('node:http')
const crypto = require('node:crypto')
const { passwordMatches, parseBasic } = require('./launcher.js')

const TOOLS = ['phone_info', 'phone_clipboard_read', 'phone_clipboard_write', 'phone_notify', 'phone_speak', 'phone_location', 'phone_photo']
const MAX_QUEUE = 20
const MAX_BODY = 12 * 1024 * 1024 // a photo comes back as base64
const CALL_TIMEOUT_MS = 120_000
const POLL_WAIT_MS = 25_000
const ONLINE_WINDOW_MS = 40_000
const MAX_FAILS = 6

function createBridge(deps) {
  const now = deps.now || Date.now
  const pending = [] // { id, tool, args } waiting for the phone
  const waiting = new Map() // id -> { resolve, timer }
  let pollers = [] // phone polls currently held open: { res, timer }
  let lastPoll = 0
  const fails = new Map()

  const send = (res, code, body) => {
    const text = body === undefined ? '' : JSON.stringify(body)
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store' })
    res.end(text)
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return }
        chunks.push(c)
      })
      req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) } catch { reject(new Error('bad json')) } })
      req.on('error', reject)
    })
  }

  function deliver() {
    while (pollers.length && pending.length) {
      const poller = pollers.shift()
      clearTimeout(poller.timer)
      send(poller.res, 200, pending.shift())
    }
  }

  function call(tool, args) {
    if (!TOOLS.includes(tool)) return Promise.resolve({ ok: false, error: `unknown tool ${tool}` })
    if (now() - lastPoll > ONLINE_WINDOW_MS) return Promise.resolve({ ok: false, error: 'phone is not connected: open the OpenCode app on the phone' })
    if (pending.length + waiting.size >= MAX_QUEUE) return Promise.resolve({ ok: false, error: 'too many pending phone requests' })
    const id = crypto.randomBytes(8).toString('hex')
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiting.delete(id)
        const i = pending.findIndex((p) => p.id === id)
        if (i >= 0) pending.splice(i, 1)
        resolve({ ok: false, error: 'the phone did not answer in time (the user may have declined or looked away)' })
      }, deps.callTimeoutMs || CALL_TIMEOUT_MS)
      waiting.set(id, { resolve, timer })
      pending.push({ id, tool, args: args && typeof args === 'object' ? args : {} })
      deliver()
    })
  }

  function finishCall(id, result) {
    const w = waiting.get(id)
    if (!w) return false
    clearTimeout(w.timer)
    waiting.delete(id)
    w.resolve(result)
    return true
  }

  async function handle(req, res) {
    const address = req.socket.remoteAddress || '?'
    const t = now()
    const rec = fails.get(address)
    if (rec && t - rec.since > 60_000) fails.delete(address)
    if ((fails.get(address) || { count: 0 }).count >= MAX_FAILS) return send(res, 429, { ok: false, error: 'too many attempts' })
    const creds = parseBasic(req.headers.authorization)
    if (!creds || creds.user !== 'opencode' || !passwordMatches(creds.password, deps.readPassword())) {
      const cur = fails.get(address) || { count: 0, since: t }
      fails.set(address, { count: cur.count + 1, since: cur.since })
      return send(res, 401, { ok: false, error: 'unauthorized' })
    }
    const route = (req.url || '/').split('?')[0]
    try {
      if (route === '/status' && req.method === 'GET') return send(res, 200, { ok: true, phoneOnline: t - lastPoll <= ONLINE_WINDOW_MS, pending: pending.length, tools: TOOLS })
      if (route === '/poll' && req.method === 'GET') {
        lastPoll = t
        if (pending.length) return send(res, 200, pending.shift())
        const poller = { res, timer: setTimeout(() => { pollers = pollers.filter((p) => p !== poller); send(res, 204) }, deps.pollWaitMs || POLL_WAIT_MS) }
        pollers.push(poller)
        req.on('close', () => { clearTimeout(poller.timer); pollers = pollers.filter((p) => p !== poller) })
        return undefined
      }
      if (route === '/result' && req.method === 'POST') {
        const body = await readBody(req)
        lastPoll = now()
        const ok = finishCall(String(body.id), body.ok ? { ok: true, data: body.data } : { ok: false, error: String(body.error || 'failed') })
        return send(res, ok ? 200 : 404, { ok })
      }
      if (route === '/call' && req.method === 'POST') {
        const body = await readBody(req)
        return send(res, 200, await call(String(body.tool), body.args))
      }
      return send(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      return send(res, 400, { ok: false, error: String(error && error.message ? error.message : error) })
    }
  }

  return { handle, call, TOOLS }
}

/** Starts the bridge HTTP server. `host` is 127.0.0.1 unless the installer chose a LAN address. */
function listen({ port, host, readPassword }) {
  const bridge = createBridge({ readPassword })
  const server = http.createServer((req, res) => { bridge.handle(req, res) })
  server.on('error', () => { /* port busy: another bridge is already running */ })
  server.listen(port, host)
  return server
}

module.exports = { createBridge, listen, TOOLS }
