'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { createBridge } = require('./phone-bridge.js')
const { handleMessage, toMcpResult, TOOL_DEFS } = require('./phone-mcp.js')

const PASSWORD = 'correct-horse-battery-1234'
const AUTH = 'Basic ' + Buffer.from('opencode:' + PASSWORD).toString('base64')

async function withBridge(extra, fn) {
  const bridge = createBridge({ readPassword: () => PASSWORD, pollWaitMs: 150, callTimeoutMs: 400, ...extra })
  const server = http.createServer((req, res) => { bridge.handle(req, res) })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const req = (method, path, body, auth = AUTH) => new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body)
    const r = http.request({ host: '127.0.0.1', port, path, method, headers: { ...(auth ? { Authorization: auth } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
      let t = ''
      res.on('data', (c) => { t += c })
      res.on('end', () => resolve({ status: res.statusCode, json: t ? JSON.parse(t) : null }))
    })
    r.on('error', reject)
    r.end(data)
  })
  try { await fn(req) } finally { server.close() }
}

test('requests without the password are refused', async () => {
  await withBridge({}, async (req) => {
    assert.equal((await req('GET', '/status', undefined, null)).status, 401)
    assert.equal((await req('POST', '/call', { tool: 'phone_info' }, 'Basic ' + Buffer.from('opencode:no').toString('base64'))).status, 401)
  })
})

test('a call fails fast when the phone is not connected', async () => {
  await withBridge({}, async (req) => {
    const r = await req('POST', '/call', { tool: 'phone_info' })
    assert.equal(r.json.ok, false)
    assert.match(r.json.error, /not connected/)
  })
})

test('call -> poll -> result round trip', async () => {
  await withBridge({}, async (req) => {
    const idle = await req('GET', '/poll') // marks the phone online, nothing queued
    assert.equal(idle.status, 204)
    const call = req('POST', '/call', { tool: 'phone_clipboard_write', args: { text: 'hi' } })
    const job = await req('GET', '/poll')
    assert.equal(job.status, 200)
    assert.equal(job.json.tool, 'phone_clipboard_write')
    assert.deepEqual(job.json.args, { text: 'hi' })
    assert.equal((await req('POST', '/result', { id: job.json.id, ok: true, data: { done: true } })).status, 200)
    assert.deepEqual((await call).json, { ok: true, data: { done: true } })
  })
})

test('a held poll receives a call that arrives later', async () => {
  await withBridge({ pollWaitMs: 2000 }, async (req) => {
    await req('GET', '/poll')
    const held = req('GET', '/poll')
    await new Promise((r) => setTimeout(r, 30))
    const call = req('POST', '/call', { tool: 'phone_notify', args: { body: 'x' } })
    const job = await held
    assert.equal(job.json.tool, 'phone_notify')
    await req('POST', '/result', { id: job.json.id, ok: false, error: 'declined' })
    assert.deepEqual((await call).json, { ok: false, error: 'declined' })
  })
})

test('a call the phone never answers times out; unknown tools and results are rejected', async () => {
  await withBridge({}, async (req) => {
    await req('GET', '/poll')
    const r = await req('POST', '/call', { tool: 'phone_info' })
    assert.equal(r.json.ok, false)
    assert.match(r.json.error, /did not answer/)
    assert.match((await req('POST', '/call', { tool: 'rm_rf' })).json.error, /unknown tool/)
    assert.equal((await req('POST', '/result', { id: 'nope', ok: true })).status, 404)
  })
})

test('MCP shim lists tools, forwards calls, and returns photos as images', async () => {
  const init = await handleMessage({ id: 1, method: 'initialize', params: {} }, async () => ({}))
  assert.equal(init.result.serverInfo.name, 'opencode-phone')
  const list = await handleMessage({ id: 2, method: 'tools/list' }, async () => ({}))
  assert.equal(list.result.tools.length, TOOL_DEFS.length)
  const seen = []
  const call = await handleMessage({ id: 3, method: 'tools/call', params: { name: 'phone_speak', arguments: { text: 'yo' } } }, async (t, a) => { seen.push([t, a]); return { ok: true, data: 'spoken' } })
  assert.deepEqual(seen, [['phone_speak', { text: 'yo' }]])
  assert.equal(call.result.content[0].text, 'spoken')
  assert.equal(toMcpResult('phone_photo', { ok: true, data: { base64: 'AAA', mime: 'image/jpeg' } }).content[0].type, 'image')
  assert.equal(toMcpResult('phone_info', { ok: false, error: 'no' }).isError, true)
  assert.ok((await handleMessage({ id: 4, method: 'tools/call', params: { name: 'bad' } }, async () => ({}))).error)
  assert.equal(await handleMessage({ method: 'notifications/initialized' }, async () => ({})), null)
})
