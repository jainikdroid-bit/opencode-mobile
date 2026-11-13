'use strict'
// ACP bridge: lets the phone talk to other coding agents on this computer (Claude Code, Codex, Gemini CLI,
// Goose, OpenCode, ...) through the Agent Client Protocol (https://agentclientprotocol.com): JSON-RPC over the
// agent's stdin/stdout. The bridge is a dumb pipe plus a replay log; the phone is the ACP client.
//
// Served by the launcher (tools/launcher.js) behind the same password, so it is reachable exactly like the
// launcher: at home directly, away through Tailscale. Routes (all under /acp/):
//   GET  /acp/agents              which known agents are installed, which are running
//   POST /acp/start {agent, cwd}  start one -> {id, cwd}
//   GET  /acp/<id>/events?from=N  Server-Sent Events: everything the agent said (and the phone sent) from
//                                 sequence N on, then "live", then new messages as they come
//   POST /acp/<id>/send <json>    one JSON-RPC message for the agent's stdin
//   POST /acp/<id>/stop           stop the agent
//
// It still runs no arbitrary commands: only agents from the table below, with fixed arguments (the third-party
// adapters are pinned to the versions the ACP registry lists), in a folder that must already exist.
// The log lets the phone close the app and come back to a running agent: a replay rebuilds the whole chat.

const { spawn, spawnSync, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const WIN = process.platform === 'win32'
const MAX_RUNNING = 4
const MAX_LOG_MESSAGES = 5000
const MAX_LOG_BYTES = 16 * 1024 * 1024
const MAX_SEND_BYTES = 8 * 1024 * 1024 // a prompt can carry images
const MAX_START_BYTES = 4096
const MAX_LINE_BYTES = 16 * 1024 * 1024
const STDERR_TAIL_BYTES = 4096
const HEARTBEAT_MS = 15_000
const SWEEP_MS = 60_000
const IDLE_STOP_MS = 6 * 3600_000 // nobody attached and nothing said for this long: stop it
const EXITED_KEEP_MS = 30 * 60_000 // a finished agent stays listed, so the phone can still read why it ended
const DETECT_TTL_MS = 60_000

/** The agents the phone may start. `bin` is what must be on PATH; `cmd` is what runs (npx for the adapters). */
const AGENTS = [
  { id: 'opencode', name: 'OpenCode', bin: 'opencode', cmd: 'opencode', args: ['acp'] },
  { id: 'claude', name: 'Claude Code', bin: 'claude', cmd: 'npx', args: ['-y', '@agentclientprotocol/claude-agent-acp@0.107.0'] },
  { id: 'codex', name: 'Codex', bin: 'codex', cmd: 'npx', args: ['-y', '@agentclientprotocol/codex-acp@2.6.0'] },
  { id: 'gemini', name: 'Gemini CLI', bin: 'gemini', cmd: 'gemini', args: ['--acp'] },
  { id: 'goose', name: 'Goose', bin: 'goose', cmd: 'goose', args: ['acp'] },
  { id: 'qwen', name: 'Qwen Code', bin: 'qwen', cmd: 'qwen', args: ['--acp'] },
  { id: 'copilot', name: 'GitHub Copilot', bin: 'copilot', cmd: 'copilot', args: ['--acp'] },
]

/** Is a program on PATH? (where.exe on Windows, command -v elsewhere.) */
function onPath(name) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return false
  try {
    const r = WIN ? spawnSync('where.exe', [name], { stdio: 'ignore', windowsHide: true }) : spawnSync('sh', ['-c', `command -v ${name}`], { stdio: 'ignore' })
    return r.status === 0
  } catch { return false }
}

/** Kill a process and its children. */
function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode) return
  try {
    if (WIN) execFileSync('taskkill.exe', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore', windowsHide: true })
    else { child.kill('SIGTERM'); setTimeout(() => { try { child.kill('SIGKILL') } catch { /* gone */ } }, 3000).unref() }
  } catch { /* already gone */ }
}

const keyOf = (id) => JSON.stringify(id)

/**
 * deps (all optional, for tests): agents (table), detect(agent) -> boolean, now() -> ms.
 * Entries with `direct: true` run `cmd` as it is (no cmd.exe wrapper).
 */
function createAcpBridge(deps = {}) {
  const agents = deps.agents || AGENTS
  const now = deps.now || (() => Date.now())
  const sessions = new Map()
  let detected = { at: 0, ids: new Set() }

  function installedIds() {
    if (now() - detected.at < DETECT_TTL_MS) return detected.ids
    const ids = new Set()
    const check = deps.detect || ((agent) => onPath(agent.bin) && (agent.cmd === agent.bin || onPath(agent.cmd)))
    for (const agent of agents) { try { if (check(agent)) ids.add(agent.id) } catch { /* not installed */ } }
    detected = { at: now(), ids }
    return ids
  }

  const send = (res, code, body) => {
    const text = JSON.stringify(body)
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store' })
    res.end(text)
  }

  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const chunks = []
      let size = 0
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > limit) { reject(Object.assign(new Error('body too large'), { code: 413 })); req.destroy(); return }
        chunks.push(chunk)
      })
      req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(Object.assign(new Error('not JSON'), { code: 400 })) } })
      req.on('error', (e) => reject(e))
    })
  }

  // ----- one running agent -----

  function frame(entry) {
    return `id: ${entry.seq}\n${entry.kind === 'sent' ? 'event: sent\n' : ''}data: ${entry.text}\n\n`
  }

  function add(session, kind, text, reqKey) {
    const entry = { seq: session.nextSeq++, kind, text, reqKey: reqKey || null }
    session.log.push(entry)
    session.bytes += text.length
    while (session.log.length > MAX_LOG_MESSAGES || session.bytes > MAX_LOG_BYTES) session.bytes -= session.log.shift().text.length
    session.lastActivity = now()
    for (const client of session.clients) client.write(frame(entry))
  }

  /** An agent's request the phone already answered is not worth showing again after a reconnect. */
  const stale = (session, entry) => entry.reqKey !== null && session.answered.has(entry.reqKey)

  function onLine(session, line) {
    const text = line.trim()
    if (!text) return
    let message
    try { message = JSON.parse(text) } catch { message = null }
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      session.stderr = (session.stderr + text + '\n').slice(-STDERR_TAIL_BYTES) // stray output: keep it for diagnosis
      return
    }
    const isRequest = typeof message.method === 'string' && message.id !== undefined && message.id !== null
    add(session, 'out', text, isRequest ? keyOf(message.id) : null)
  }

  function start(agent, cwd) {
    const options = { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, NO_COLOR: '1' } }
    const child = WIN && !agent.direct ? spawn('cmd.exe', ['/c', agent.cmd, ...agent.args], options) : spawn(agent.cmd, agent.args, options)
    const session = {
      id: crypto.randomBytes(9).toString('base64url'), agent: agent.id, name: agent.name, cwd, startedAt: now(), lastActivity: now(),
      child, log: [], bytes: 0, nextSeq: 1, clients: new Set(), answered: new Set(), stderr: '', exited: null,
    }
    let partial = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      partial += chunk
      let at
      while ((at = partial.indexOf('\n')) >= 0) { onLine(session, partial.slice(0, at)); partial = partial.slice(at + 1) }
      if (partial.length > MAX_LINE_BYTES) { partial = ''; killTree(child) }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => { session.stderr = (session.stderr + chunk).slice(-STDERR_TAIL_BYTES) })
    child.stdin.on('error', () => { /* the agent is gone: the exit handler reports it */ })
    child.on('error', (error) => { session.stderr = (session.stderr + String(error.message || error)).slice(-STDERR_TAIL_BYTES) })
    child.on('close', (code, signal) => {
      if (partial.trim()) onLine(session, partial)
      session.exited = { code, signal, stderr: session.stderr, at: now() }
      const text = `event: exit\ndata: ${JSON.stringify({ code, signal, stderr: session.stderr })}\n\n`
      for (const client of session.clients) { client.write(text); client.end() }
      session.clients.clear()
    })
    sessions.set(session.id, session)
    return session
  }

  // ----- routes -----

  function agentsRoute(res) {
    const installed = installedIds()
    send(res, 200, {
      ok: true,
      agents: agents.map((a) => ({ id: a.id, name: a.name, installed: installed.has(a.id) })),
      running: [...sessions.values()].map((s) => ({ id: s.id, agent: s.agent, name: s.name, cwd: s.cwd, startedAt: s.startedAt, exited: !!s.exited })),
    })
  }

  async function startRoute(req, res) {
    const body = await readBody(req, MAX_START_BYTES)
    const agent = agents.find((a) => a.id === (body && body.agent))
    if (!agent) return send(res, 400, { ok: false, error: 'unknown agent' })
    if (!installedIds().has(agent.id)) return send(res, 404, { ok: false, error: `${agent.name} is not installed on this computer` })
    let cwd = os.homedir()
    if (body.cwd !== undefined && body.cwd !== null && body.cwd !== '') {
      if (typeof body.cwd !== 'string' || !path.isAbsolute(body.cwd)) return send(res, 400, { ok: false, error: 'the folder must be an absolute path' })
      try { if (!fs.statSync(body.cwd).isDirectory()) throw new Error('not a folder') } catch { return send(res, 400, { ok: false, error: 'that folder does not exist on the computer' }) }
      cwd = path.resolve(body.cwd)
    }
    if ([...sessions.values()].filter((s) => !s.exited).length >= MAX_RUNNING) return send(res, 429, { ok: false, error: `at most ${MAX_RUNNING} agents at once: stop one first` })
    const session = start(agent, cwd)
    send(res, 200, { ok: true, id: session.id, agent: agent.id, name: agent.name, cwd })
  }

  function eventsRoute(req, res, session, query) {
    const fromHeader = Number(req.headers['last-event-id'])
    const from = Math.max(1, Number.isInteger(Number(query.get('from'))) && query.get('from') ? Number(query.get('from')) : Number.isInteger(fromHeader) && fromHeader > 0 ? fromHeader + 1 : 1)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    if (res.socket) { res.socket.setNoDelay(true); res.socket.setTimeout(0) }
    const first = session.log.length ? session.log[0].seq : session.nextSeq
    if (from < first) res.write(`event: gap\ndata: ${JSON.stringify({ firstSeq: first })}\n\n`)
    for (const entry of session.log) if (entry.seq >= from && !stale(session, entry)) res.write(frame(entry))
    res.write('event: live\ndata: {}\n\n')
    if (session.exited) {
      res.write(`event: exit\ndata: ${JSON.stringify({ code: session.exited.code, signal: session.exited.signal, stderr: session.exited.stderr })}\n\n`)
      return res.end()
    }
    session.clients.add(res)
    const beat = setInterval(() => { try { res.write(': hb\n\n') } catch { /* closed */ } }, HEARTBEAT_MS)
    req.on('close', () => { clearInterval(beat); session.clients.delete(res); session.lastActivity = now() })
  }

  async function sendRoute(req, res, session) {
    if (session.exited) return send(res, 409, { ok: false, error: 'the agent has stopped' })
    const message = await readBody(req, MAX_SEND_BYTES)
    const isRequest = message && message.jsonrpc === '2.0' && typeof message.method === 'string'
    const isResponse = message && message.jsonrpc === '2.0' && message.id !== undefined && message.id !== null && typeof message.method !== 'string' && ('result' in message || 'error' in message)
    if (!isRequest && !isResponse) return send(res, 400, { ok: false, error: 'not a JSON-RPC message' })
    if (isResponse) session.answered.add(keyOf(message.id))
    const text = JSON.stringify(message)
    session.child.stdin.write(text + '\n')
    add(session, 'sent', text)
    send(res, 200, { ok: true, seq: session.nextSeq - 1 })
  }

  /** Returns true when the route is ours (the launcher has already checked the password). */
  async function handle(req, res, route) {
    const url = new URL(req.url || '/', 'http://x')
    try {
      if (route === '/acp/agents' && req.method === 'GET') return agentsRoute(res), true
      if (route === '/acp/start' && req.method === 'POST') return await startRoute(req, res), true
      const m = /^\/acp\/([A-Za-z0-9_-]{6,32})\/(events|send|stop)$/.exec(route)
      if (!m) return send(res, 404, { ok: false, error: 'not found' }), true
      const session = sessions.get(m[1])
      if (!session) return send(res, 404, { ok: false, error: 'no such agent (it may have been stopped)' }), true
      if (m[2] === 'events' && req.method === 'GET') return eventsRoute(req, res, session, url.searchParams), true
      if (m[2] === 'send' && req.method === 'POST') return await sendRoute(req, res, session), true
      if (m[2] === 'stop' && req.method === 'POST') { killTree(session.child); return send(res, 200, { ok: true }), true }
      send(res, 405, { ok: false, error: 'wrong method' })
    } catch (error) {
      if (!res.headersSent) send(res, Number(error && error.code) >= 400 && Number(error.code) < 600 ? Number(error.code) : 500, { ok: false, error: String(error && error.message ? error.message : error) })
    }
    return true
  }

  // Idle agents with nobody attached are stopped; finished ones are forgotten after a while.
  const sweep = setInterval(() => {
    for (const [id, s] of sessions) {
      if (s.exited) { if (now() - s.exited.at > EXITED_KEEP_MS) sessions.delete(id) }
      else if (s.clients.size === 0 && now() - s.lastActivity > IDLE_STOP_MS) killTree(s.child)
    }
  }, SWEEP_MS)
  sweep.unref()

  return {
    handle,
    list: () => [...sessions.values()],
    stopAll() { clearInterval(sweep); for (const s of sessions.values()) killTree(s.child) },
  }
}

module.exports = { createAcpBridge, AGENTS, onPath }
