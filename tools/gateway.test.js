'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { EventEmitter } = require('node:events')
const { route, createGateway } = require('./gateway.js')
const { extractTunnelUrl, backoff, isValidTopic, startTunnel } = require('./tunnel.js')

const PORTS = { server: 1, launcher: 2, bridge: 3 }

test('routing by path prefix', () => {
  assert.deepEqual(route('/global/health', PORTS), { port: 1, path: '/global/health' })
  assert.deepEqual(route('/__oc/launcher/status', PORTS), { port: 2, path: '/status' })
  assert.deepEqual(route('/__oc/bridge/poll?x=1', PORTS), { port: 3, path: '/poll?x=1' })
  assert.deepEqual(route('/__oc/launcher', PORTS), { port: 2, path: '/' })
  assert.equal(route('/__oc/other/x', PORTS), null)
  assert.deepEqual(route('/__ocx/y', PORTS), { port: 1, path: '/__ocx/y' })
})

const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)))
const get = (port, path, headers = {}) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path, headers }, (res) => {
    let t = ''
    res.on('data', (c) => { t += c })
    res.on('end', () => resolve({ status: res.statusCode, body: t }))
  }).on('error', reject)
})

test('gateway forwards to the right upstream, streams, and blocks guessers', async () => {
  const seen = []
  const upstream = (name, status = 200) => http.createServer((req, res) => {
    seen.push(`${name}:${req.url}`)
    res.writeHead(req.headers.authorization === 'ok' ? status : 401)
    res.end(name)
  })
  const sv = upstream('server'); const ln = upstream('launcher')
  const [ps, pl] = [await listen(sv), await listen(ln)]
  const gw = createGateway({ ports: { server: ps, launcher: pl, bridge: 9 } })
  const front = http.createServer(gw.handle)
  const pf = await listen(front)
  try {
    assert.equal((await get(pf, '/a', { authorization: 'ok' })).body, 'server')
    assert.equal((await get(pf, '/__oc/launcher/status', { authorization: 'ok' })).body, 'launcher')
    assert.deepEqual(seen, ['server:/a', 'launcher:/status'])
    assert.equal((await get(pf, '/__oc/bridge/poll')).status, 502) // nothing listens on port 9
    for (let i = 0; i < 10; i++) await get(pf, '/a', { authorization: 'bad' })
    assert.equal((await get(pf, '/a', { authorization: 'ok' })).status, 429, 'guessing client is blocked')
    assert.equal((await get(pf, '/a', { authorization: 'ok', 'cf-connecting-ip': '9.9.9.9' })).status, 200, 'other clients are not')
  } finally { sv.close(); ln.close(); front.close() }
})

test('tunnel address is extracted from cloudflared output', () => {
  assert.equal(extractTunnelUrl('INF |  https://random-words-here.trycloudflare.com  |'), 'https://random-words-here.trycloudflare.com')
  assert.equal(extractTunnelUrl('nothing yet'), null)
  assert.equal(extractTunnelUrl('https://evil.example.com/trycloudflare.com'), null)
})

test('restart delay grows and is capped; topic names are validated', () => {
  assert.deepEqual([0, 1, 2, 3, 10].map(backoff), [2000, 4000, 8000, 16000, 60000])
  assert.equal(isValidTopic('ocx-0123456789abcdef0123'), true)
  assert.equal(isValidTopic('short'), false)
  assert.equal(isValidTopic('../../etc/passwd-xxxxxxxxxxxx'), false)
})

test('tunnel reports the address once per run and restarts when cloudflared exits', async () => {
  const urls = []
  let runs = 0
  const spawnFn = () => {
    runs++
    const child = new EventEmitter()
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter()
    child.kill = () => child.emit('exit')
    setTimeout(() => { child.stderr.emit('data', `url https://run-${runs}.trycloudflare.com`); child.stderr.emit('data', 'https://run-x.trycloudflare.com'); if (runs === 1) child.emit('exit') }, 5)
    return child
  }
  const t = startTunnel({ binary: 'x', targetPort: 1, onUrl: (u) => urls.push(u), spawnFn, sleep: () => new Promise((r) => setTimeout(r, 5)) })
  await new Promise((r) => setTimeout(r, 120))
  t.stop()
  assert.deepEqual(urls.slice(0, 2), ['https://run-1.trycloudflare.com', 'https://run-2.trycloudflare.com'])
})
