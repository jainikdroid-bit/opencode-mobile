'use strict'
// Home-network mirror: a phone at home reaches the server directly, without Tailscale or a VPN.
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const net = require('node:net')
const { createLauncher, lanAddresses, startLanForward } = require('./launcher.js')
const { buildLink, lanIp } = require('./connect.js')

const nic = (address, netmask = '255.255.255.0') => ({ family: 'IPv4', internal: false, address, netmask })

test('home-network addresses: private only, VPN /32 links skipped, 192.168 first', () => {
  const nics = {
    vpn: [nic('172.16.0.2', '255.255.255.255')],
    wsl: [nic('172.20.1.1', '255.255.240.0')],
    tailscale: [nic('100.64.0.7', '255.255.255.255')],
    office: [nic('10.0.0.7')],
    wifi: [nic('192.168.1.159')],
    lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1', netmask: '255.0.0.0' }],
  }
  assert.deepEqual(lanAddresses(nics), ['192.168.1.159', '10.0.0.7', '172.20.1.1'])
  assert.equal(lanIp(nics), '192.168.1.159')
  assert.equal(lanIp({ vpn: [nic('172.16.0.2', '255.255.255.255')] }), null)
})

test('pairing link carries the home-network address only when given', () => {
  const link = buildLink({ url: 'http://100.1.2.3:4096', password: 'p', name: 'PC', launcherPort: 4095, lan: '192.168.1.20' })
  assert.match(link, /&lan=192\.168\.1\.20$/)
  assert.ok(!buildLink({ url: 'http://100.1.2.3:4096', password: 'p', name: 'PC' }).includes('lan='))
})

test('the mirror passes TCP through to the local port and follows address changes', async () => {
  const echo = net.createServer((s) => s.pipe(s))
  await new Promise((r) => echo.listen(0, '127.0.0.1', r))
  const port = echo.address().port
  let current = ['127.0.0.2']
  const mirror = startLanForward([port], { addresses: () => current, rescanMs: 60_000 })
  const roundTrip = (host) => new Promise((resolve, reject) => {
    const s = net.connect(port, host, () => s.end('ping'))
    let got = ''
    s.on('data', (d) => { got += d })
    s.on('end', () => resolve(got))
    s.on('error', reject)
  })
  try {
    await new Promise((r) => setTimeout(r, 50))
    assert.deepEqual(mirror.listening(), [`127.0.0.2 ${port}`])
    assert.equal(await roundTrip('127.0.0.2'), 'ping')
  } finally {
    mirror.close()
    echo.close()
  }
})

test('pairing and status report where the phone can reach this computer', async () => {
  const state = { port: 4096, launcherPort: 4095, name: 'PC', linkHost: '100.1.2.3', lanForward: true }
  const launcher = createLauncher({
    readPassword: () => 'pw-1234567890',
    readState: () => state,
    health: async () => true,
    startServer: () => {},
    stopServer: async () => {},
    sleep: async () => {},
    readPair: () => ({ code: '123456', expires: Date.now() + 60_000, fails: 0 }),
    writePair: () => {},
    lanHost: () => '192.168.1.20',
  })
  const server = http.createServer((req, res) => { launcher.handle(req, res) })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const post = () => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/pair', method: 'POST' }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve(JSON.parse(body)))
    })
    req.on('error', reject)
    req.end(JSON.stringify({ code: '123456' }))
  })
  try {
    const reply = await post()
    assert.equal(reply.ok, true)
    assert.equal(reply.host, '100.1.2.3')
    assert.equal(reply.lan, '192.168.1.20')
  } finally {
    server.close()
  }
})

test('hello proves the password without sending it', async () => {
  const { helloProof } = require('./launcher.js')
  const crypto = require('node:crypto')
  const launcher = createLauncher({ readPassword: () => 'pw-1234567890', readState: () => ({ port: 4096 }), health: async () => true, startServer: () => {}, stopServer: async () => {}, sleep: async () => {} })
  const server = http.createServer((req, res) => { launcher.handle(req, res) })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const get = (route) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: route }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, body, json: JSON.parse(body) }))
    }).on('error', reject)
  })
  try {
    const nonce = 'abcdef0123456789abcdef'
    const ok = await get(`/hello?n=${nonce}`)
    assert.equal(ok.status, 200)
    assert.equal(ok.json.proof, crypto.createHash('sha256').update(`${nonce}:pw-1234567890`).digest('hex'))
    assert.equal(ok.json.proof, helloProof(nonce, 'pw-1234567890'))
    assert.ok(!ok.body.includes('pw-1234567890'))
    assert.equal((await get('/hello?n=short')).status, 400)
    assert.equal((await get('/status')).status, 401)
  } finally {
    server.close()
  }
})
