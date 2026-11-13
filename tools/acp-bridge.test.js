'use strict'
// The ACP bridge, against a small fake ACP agent (a node script that speaks JSON-RPC lines on stdio).
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createAcpBridge, AGENTS } = require('./acp-bridge.js')

const FAKE_AGENT = `
const rl = require('node:readline').createInterface({ input: process.stdin })
const out = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\\n')
rl.on('line', (line) => {
  const m = JSON.parse(line)
  if (m.method === 'initialize') return out({ id: m.id, result: { protocolVersion: 1, agentCapabilities: {}, authMethods: [] } })
  if (m.method === 'session/new') return out({ id: m.id, result: { sessionId: 's1' } })
  if (m.method === 'session/prompt') {
    process.stdout.write('banner that is not JSON\\n')
    out({ method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } } } })
    out({ id: 900, method: 'session/request_permission', params: { sessionId: 's1', toolCall: { toolCallId: 't1' }, options: [{ optionId: 'ok', name: 'Allow', kind: 'allow_once' }] } })
    globalThis.promptId = m.id
    return
  }
  if (m.id === 900) return out({ id: globalThis.promptId, result: { stopReason: 'end_turn' } })
  if (m.method === 'die') process.exit(3)
})
`

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acp-test-'))
  const script = path.join(dir, 'agent.js')
  fs.writeFileSync(script, FAKE_AGENT)
  const bridge = createAcpBridge({
    agents: [{ id: 'fake', name: 'Fake agent', bin: 'fake', cmd: process.execPath, args: [script], direct: true }, { id: 'absent', name: 'Absent', bin: 'absent', cmd: 'absent', args: [] }],
    detect: (agent) => agent.id === 'fake',
  })
  const server = http.createServer((req, res) => { bridge.handle(req, res, (req.url || '/').split('?')[0]) })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    const call = (method, route, body) => new Promise((ok, fail) => {
      const req = http.request({ host: '127.0.0.1', port, path: route, method }, (res) => {
        let text = ''
        res.on('data', (c) => { text += c })
        res.on('end', () => ok({ status: res.statusCode, json: text ? JSON.parse(text) : null }))
      })
      req.on('error', fail)
      req.end(body === undefined ? undefined : JSON.stringify(body))
    })
    /** Read the event stream until `until(events)` is true; returns the events as { event, id, data }. */
    const stream = (route, until) => new Promise((ok, fail) => {
      const events = []
      const req = http.get({ host: '127.0.0.1', port, path: route }, (res) => {
        let buffer = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          buffer += chunk
          let at
          while ((at = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, at)
            buffer = buffer.slice(at + 2)
            if (block.startsWith(':')) continue
            const e = { event: 'message', id: null, data: null }
            for (const line of block.split('\n')) {
              if (line.startsWith('event: ')) e.event = line.slice(7)
              else if (line.startsWith('id: ')) e.id = Number(line.slice(4))
              else if (line.startsWith('data: ')) e.data = JSON.parse(line.slice(6))
            }
            events.push(e)
            if (until(events)) { req.destroy(); ok(events); return }
          }
        })
        res.on('end', () => ok(events))
      })
      req.on('error', (e) => (e.code === 'ECONNRESET' ? ok(events) : fail(e)))
    })
    resolve({ call, stream, bridge, close() { bridge.stopAll(); server.close(); fs.rmSync(dir, { recursive: true, force: true }) } })
  }))
}

const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, params })

test('only installed agents can start; folders must exist; the table is fixed', async () => {
  const t = await setup()
  try {
    const list = await t.call('GET', '/acp/agents')
    assert.deepEqual(list.json.agents.map((a) => [a.id, a.installed]), [['fake', true], ['absent', false]])
    assert.equal((await t.call('POST', '/acp/start', { agent: 'absent' })).status, 404)
    assert.equal((await t.call('POST', '/acp/start', { agent: 'rm -rf /' })).status, 400)
    assert.equal((await t.call('POST', '/acp/start', { agent: 'fake', cwd: 'relative/dir' })).status, 400)
    assert.equal((await t.call('POST', '/acp/start', { agent: 'fake', cwd: path.join(os.tmpdir(), 'no-such-folder-xyz') })).status, 400)
    assert.equal((await t.call('GET', '/acp/zzzzzzzz/events')).status, 404)
  } finally { t.close() }
})

test('a chat round trip: handshake, a permission request, and the answer', async () => {
  const t = await setup()
  try {
    const started = await t.call('POST', '/acp/start', { agent: 'fake', cwd: os.tmpdir() })
    assert.equal(started.status, 200)
    const id = started.json.id
    assert.equal((await t.call('POST', `/acp/${id}/send`, rpc(1, 'initialize', { protocolVersion: 1 }))).status, 200)
    assert.equal((await t.call('POST', `/acp/${id}/send`, rpc(2, 'session/new', { cwd: os.tmpdir(), mcpServers: [] }))).status, 200)
    assert.equal((await t.call('POST', `/acp/${id}/send`, rpc(3, 'session/prompt', { sessionId: 's1', prompt: [{ type: 'text', text: 'hi' }] }))).status, 200)
    const first = await t.stream(`/acp/${id}/events`, (e) => e.some((x) => x.data && x.data.method === 'session/request_permission'))
    const kinds = first.map((e) => e.event)
    assert.ok(kinds.includes('sent'), 'what the phone sent is echoed, so a replay can rebuild the chat')
    assert.ok(first.some((e) => e.data && e.data.result && e.data.id === 2 && e.data.result.sessionId === 's1'))
    assert.ok(first.some((e) => e.data && e.data.params && e.data.params.update && e.data.params.update.content.text === 'Hello'))
    assert.ok(!JSON.stringify(first).includes('banner'), 'stray non-JSON output is not forwarded')
    // answer the permission request, then watch the turn end
    const live = t.stream(`/acp/${id}/events?from=${first.at(-1).id + 1}`, (e) => e.some((x) => x.data && x.data.result && x.data.result.stopReason === 'end_turn'))
    await new Promise((r) => setTimeout(r, 100))
    await t.call('POST', `/acp/${id}/send`, { jsonrpc: '2.0', id: 900, result: { outcome: { outcome: 'selected', optionId: 'ok' } } })
    assert.ok((await live).some((x) => x.data && x.data.result && x.data.result.stopReason === 'end_turn'))
    // a reconnect from the start replays the chat, without the request that was already answered
    const replay = await t.stream(`/acp/${id}/events`, (e) => e.some((x) => x.event === 'live'))
    assert.ok(!replay.some((e) => e.data && e.data.method === 'session/request_permission'))
    assert.ok(replay.some((e) => e.data && e.data.result && e.data.result.stopReason === 'end_turn'))
  } finally { t.close() }
})

test('the phone may only send JSON-RPC messages', async () => {
  const t = await setup()
  try {
    const { json } = await t.call('POST', '/acp/start', { agent: 'fake' })
    assert.equal((await t.call('POST', `/acp/${json.id}/send`, { hello: 'world' })).status, 400)
    assert.equal((await t.call('POST', `/acp/${json.id}/send`, { jsonrpc: '2.0', method: 7 })).status, 400)
  } finally { t.close() }
})

test('an agent that exits is reported with its exit code, and cannot be written to', async () => {
  const t = await setup()
  try {
    const { json } = await t.call('POST', '/acp/start', { agent: 'fake' })
    await t.call('POST', `/acp/${json.id}/send`, rpc(1, 'die', {}))
    const events = await t.stream(`/acp/${json.id}/events`, (e) => e.some((x) => x.event === 'exit'))
    assert.equal(events.find((e) => e.event === 'exit').data.code, 3)
    assert.equal((await t.call('POST', `/acp/${json.id}/send`, rpc(2, 'initialize', {}))).status, 409)
    assert.equal((await t.call('GET', '/acp/agents')).json.running[0].exited, true)
  } finally { t.close() }
})

test('stopping works, and the known-agents table pins the adapters', async () => {
  const t = await setup()
  try {
    const { json } = await t.call('POST', '/acp/start', { agent: 'fake' })
    assert.equal((await t.call('POST', `/acp/${json.id}/stop`)).status, 200)
    const events = await t.stream(`/acp/${json.id}/events`, (e) => e.some((x) => x.event === 'exit'))
    assert.ok(events.some((e) => e.event === 'exit'))
  } finally { t.close() }
  for (const agent of AGENTS.filter((a) => a.cmd === 'npx')) assert.match(agent.args.join(' '), /@\d+\.\d+\.\d+$/, `${agent.id} must be pinned to a version`)
})
