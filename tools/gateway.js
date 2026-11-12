'use strict'
// Gateway for tunnel mode: ONE local port in front of the opencode server, the launcher and the phone bridge, so a
// single outbound tunnel (cloudflared) can carry all three. It listens on 127.0.0.1 only.
//
//   /__oc/launcher/*  -> launcher
//   /__oc/bridge/*    -> phone bridge
//   everything else   -> opencode server
//
// It does not authenticate anything itself: every upstream already requires the password. What it adds is
// protection against guessing: repeated 401 answers to one client address block that address for a minute.
// Streams (server-sent events) and WebSocket upgrades (terminal) are passed through untouched.

const http = require('node:http')
const net = require('node:net')

const MAX_FAILS = 10
const WINDOW_MS = 60_000
const PREFIX = '/__oc/'

/** Pure: which local port and path a request goes to. */
function route(url, ports) {
  const u = url || '/'
  for (const [name, port] of [['launcher', ports.launcher], ['bridge', ports.bridge]]) {
    const base = `${PREFIX}${name}`
    if (u === base || u.startsWith(`${base}/`) || u.startsWith(`${base}?`)) {
      const rest = u.slice(base.length)
      return { port, path: rest.startsWith('/') ? rest : `/${rest}` }
    }
  }
  if (u.startsWith(PREFIX)) return null
  return { port: ports.server, path: u }
}

function createGateway({ ports, now = Date.now }) {
  const fails = new Map() // client -> { count, since }

  const clientOf = (req) => String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim()
  const blocked = (key) => {
    const r = fails.get(key)
    if (!r) return false
    if (now() - r.since > WINDOW_MS) { fails.delete(key); return false }
    return r.count >= MAX_FAILS
  }
  const recordFail = (key) => {
    const r = fails.get(key)
    if (!r || now() - r.since > WINDOW_MS) fails.set(key, { count: 1, since: now() })
    else r.count++
  }
  const reply = (res, code, text) => {
    if (res.headersSent) return res.end()
    res.writeHead(code, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
    res.end(text)
  }

  function handle(req, res) {
    const key = clientOf(req)
    if (blocked(key)) return reply(res, 429, 'too many failed attempts, wait a minute')
    const target = route(req.url, ports)
    if (!target) return reply(res, 404, 'not found')
    const upstream = http.request(
      { host: '127.0.0.1', port: target.port, path: target.path, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${target.port}` } },
      (ures) => {
        if (ures.statusCode === 401) recordFail(key)
        res.writeHead(ures.statusCode || 502, ures.headers)
        ures.pipe(res)
      },
    )
    upstream.on('error', () => reply(res, 502, 'the target is not running'))
    res.on('close', () => upstream.destroy())
    req.pipe(upstream)
  }

  function upgrade(req, socket, head) {
    const key = clientOf(req)
    const target = route(req.url, ports)
    if (!target || blocked(key)) return socket.destroy()
    const up = net.connect(target.port, '127.0.0.1', () => {
      const headers = Object.entries({ ...req.headers, host: `127.0.0.1:${target.port}` }).map(([k, v]) => `${k}: ${v}`).join('\r\n')
      up.write(`${req.method} ${target.path} HTTP/1.1\r\n${headers}\r\n\r\n`)
      if (head && head.length) up.write(head)
      socket.pipe(up)
      up.pipe(socket)
    })
    up.on('error', () => socket.destroy())
    socket.on('error', () => up.destroy())
    socket.on('close', () => up.destroy())
  }

  return { handle, upgrade }
}

function listen({ port, ports }) {
  const gateway = createGateway({ ports })
  const server = http.createServer((req, res) => gateway.handle(req, res))
  server.on('upgrade', gateway.upgrade)
  server.on('error', () => { /* port busy: a gateway is already running */ })
  server.listen(port, '127.0.0.1')
  return server
}

module.exports = { route, createGateway, listen }
