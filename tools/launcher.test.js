'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { createLauncher, passwordMatches, parseBasic } = require('./launcher.js')

const PASSWORD = 'correct-horse-battery-1234'
const basic = (user, pw) => 'Basic ' + Buffer.from(`${user}:${pw}`).toString('base64')

function fakeDeps(overrides = {}) {
  const calls = { start: 0, stop: 0 }
  let healthy = false
  const deps = {
    readPassword: () => PASSWORD,
    readState: () => ({ port: 4096 }),
    health: async () => healthy,
    startServer: () => { calls.start++; setTimeout(() => { healthy = true }, 20) },
    stopServer: async () => { calls.stop++; healthy = false },
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
    ...overrides,
  }
  return { deps, calls, setHealthy: (v) => { healthy = v } }
}

async function withServer(deps, fn) {
  const launcher = createLauncher(deps)
  const server = http.createServer((req, res) => { launcher.handle(req, res) })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const call = (method, route, auth, body) =>
    new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: route, method, headers: auth ? { Authorization: auth } : {} }, (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => resolve({ status: res.statusCode, json: body ? JSON.parse(body) : null }))
      })
      req.on('error', reject)
      req.end(body === undefined ? undefined : JSON.stringify(body))
    })
  try { await fn(call) } finally { server.close() }
}

test('password comparison is exact and handles empty values', () => {
  assert.equal(passwordMatches(PASSWORD, PASSWORD), true)
  assert.equal(passwordMatches('wrong', PASSWORD), false)
  assert.equal(passwordMatches(PASSWORD, ''), false)
  assert.equal(passwordMatches('', ''), false)
})

test('basic auth header parsing', () => {
  assert.deepEqual(parseBasic(basic('opencode', 'a:b')), { user: 'opencode', password: 'a:b' })
  assert.equal(parseBasic('Bearer x'), null)
  assert.equal(parseBasic(undefined), null)
})

test('requests without the right credentials are refused', async () => {
  const { deps } = fakeDeps()
  await withServer(deps, async (call) => {
    assert.equal((await call('GET', '/status')).status, 401)
    assert.equal((await call('GET', '/status', basic('opencode', 'nope'))).status, 401)
    assert.equal((await call('GET', '/status', basic('root', PASSWORD))).status, 401)
    assert.equal((await call('POST', '/start', basic('opencode', 'nope'))).status, 401)
  })
})

test('repeated wrong passwords get rate limited', async () => {
  const { deps } = fakeDeps()
  await withServer(deps, async (call) => {
    for (let i = 0; i < 6; i++) await call('GET', '/status', basic('opencode', 'bad'))
    assert.equal((await call('GET', '/status', basic('opencode', PASSWORD))).status, 429)
  })
})

test('status reports a stopped server, start brings it up, start again is a no-op', async () => {
  const { deps, calls } = fakeDeps()
  await withServer(deps, async (call) => {
    const auth = basic('opencode', PASSWORD)
    const before = await call('GET', '/status', auth)
    assert.equal(before.status, 200)
    assert.equal(before.json.server.running, false)

    const started = await call('POST', '/start', auth)
    assert.equal(started.status, 200)
    assert.equal(started.json.server.running, true)
    assert.equal(calls.start, 1)

    const again = await call('POST', '/start', auth)
    assert.equal(again.json.server.running, true)
    assert.equal(calls.start, 1, 'does not start a second server')
  })
})

test('stop and restart', async () => {
  const { deps, calls, setHealthy } = fakeDeps()
  setHealthy(true)
  await withServer(deps, async (call) => {
    const auth = basic('opencode', PASSWORD)
    const stopped = await call('POST', '/stop', auth)
    assert.equal(stopped.json.server.running, false)
    assert.equal(calls.stop, 1)
    const restarted = await call('POST', '/restart', auth)
    assert.equal(restarted.json.server.running, true)
    assert.equal(calls.stop, 2)
    assert.equal(calls.start, 1)
  })
})

test('only fixed actions exist; wrong methods and unknown paths are rejected', async () => {
  const { deps } = fakeDeps()
  await withServer(deps, async (call) => {
    const auth = basic('opencode', PASSWORD)
    assert.equal((await call('GET', '/start', auth)).status, 405)
    assert.equal((await call('POST', '/exec', auth)).status, 404)
    assert.equal((await call('GET', '/../etc/passwd', auth)).status, 404)
  })
})

test('start without a saved password explains what to do', async () => {
  const { deps } = fakeDeps({ readPassword: () => '' })
  // no password at all: nobody can authenticate, so the launcher stays closed
  await withServer(deps, async (call) => {
    assert.equal((await call('POST', '/start', basic('opencode', ''))).status, 401)
  })
})

test('a server that never becomes healthy is reported as an error', async () => {
  const { deps } = fakeDeps({ startServer: () => {} })
  await withServer(deps, async (call) => {
    const res = await call('POST', '/start', basic('opencode', PASSWORD))
    assert.equal(res.status, 500)
    assert.equal(res.json.ok, false)
  })
})

function pairDeps(pair) {
  const box = { pair }
  const { deps } = fakeDeps({
    readState: () => ({ port: 4096, launcherPort: 4095, name: 'My PC' }),
    readPair: () => box.pair,
    writePair: (next) => { box.pair = next },
  })
  return { deps, box }
}
const liveCode = () => ({ code: '482913', expires: Date.now() + 60_000, fails: 0 })

test('pairing is off unless the installer left a code', async () => {
  const { deps } = fakeDeps()
  await withServer(deps, async (call) => {
    assert.equal((await call('GET', '/pair')).status, 404)
    assert.equal((await call('POST', '/pair', undefined, { code: '000000' })).status, 404)
  })
  const expired = pairDeps({ code: '482913', expires: Date.now() - 1, fails: 0 })
  await withServer(expired.deps, async (call) => {
    assert.equal((await call('POST', '/pair', undefined, { code: '482913' })).status, 404)
  })
})

test('the right code gives the connection details exactly once', async () => {
  const { deps, box } = pairDeps(liveCode())
  await withServer(deps, async (call) => {
    const seen = await call('GET', '/pair')
    assert.deepEqual(seen.json, { ok: true, pairing: true, name: 'My PC' })
    const ok = await call('POST', '/pair', undefined, { code: '482 913' })
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.json, { ok: true, name: 'My PC', password: PASSWORD, port: 4096, launcherPort: 4095 })
    assert.equal(box.pair, null)
    assert.equal((await call('POST', '/pair', undefined, { code: '482913' })).status, 404)
  })
})

test('wrong codes never reveal the password and burn the code after five tries', async () => {
  const { deps, box } = pairDeps(liveCode())
  await withServer(deps, async (call) => {
    for (let left = 4; left >= 0; left--) {
      const bad = await call('POST', '/pair', undefined, { code: '111111' })
      assert.equal(bad.status, 403)
      assert.equal(bad.json.left, left)
      assert.equal(bad.json.password, undefined)
    }
    assert.equal(box.pair, null)
    assert.equal((await call('POST', '/pair', undefined, { code: '482913' })).status, 404)
  })
})

test('pairing route does not open the other routes', async () => {
  const { deps } = pairDeps(liveCode())
  await withServer(deps, async (call) => {
    assert.equal((await call('GET', '/status')).status, 401)
    assert.equal((await call('PUT', '/pair')).status, 405)
  })
})
