'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { parseArgs, buildLink, lanIp, newPassword } = require('./connect.js')
const autostart = require('./autostart.js')
const { bindHostOf } = require('./launcher.js')

test('flags work in PowerShell and POSIX style', () => {
  assert.deepEqual(parseArgs(['-Json', '-NoGuide', '-Mode', 'lan', '-Port', '5000']), { json: true, noguide: true, mode: 'lan', port: '5000' })
  assert.deepEqual(parseArgs(['--json', '--no-guide', '--mode=local', '--host-name', '10.0.2.2', '--dry-run']), { json: true, noguide: true, mode: 'local', hostname: '10.0.2.2', dryrun: true })
  assert.deepEqual(parseArgs(['--unknown', 'x', 'stray']), {})
})

test('pairing link encodes values and carries the launcher port', () => {
  const link = buildLink({ url: 'http://100.1.2.3:4096', password: 'p&w=1', name: 'My PC', launcherPort: 4095 })
  const u = new URL(link)
  assert.equal(u.protocol, 'opencode:')
  assert.equal(u.searchParams.get('url'), 'http://100.1.2.3:4096')
  assert.equal(u.searchParams.get('password'), 'p&w=1')
  assert.equal(u.searchParams.get('name'), 'My PC')
  assert.equal(u.searchParams.get('launcher'), '4095')
  assert.ok(!buildLink({ url: 'http://x:1', password: 'a', name: 'n' }).includes('launcher'))
})

test('passwords are long and random', () => {
  const a = newPassword()
  assert.equal(a.length, 24)
  assert.notEqual(a, newPassword())
})

test('lan address picks a private IPv4 and skips internal/public ones', () => {
  const nics = { lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }], eth: [{ family: 'IPv4', internal: false, address: '8.8.8.8' }, { family: 'IPv4', internal: false, address: '192.168.1.20' }] }
  assert.equal(lanIp(nics), '192.168.1.20')
  assert.equal(lanIp({}), null)
})

test('launcher binds loopback unless the installer chose a LAN address', () => {
  assert.equal(bindHostOf({}), '127.0.0.1')
  assert.equal(bindHostOf({ launcherHost: '192.168.1.20' }), '192.168.1.20')
  assert.equal(bindHostOf({ launcherHost: '0.0.0.0' }), '127.0.0.1')
  assert.equal(bindHostOf({ launcherHost: 'evil; rm' }), '127.0.0.1')
})

test('autostart files per platform', () => {
  const vbs = autostart.windowsVbs('C:\\Program Files\\nodejs\\node.exe', 'C:\\Users\\a\\launcher.js')
  assert.match(vbs, /WScript\.Shell/)
  assert.match(vbs, /, 0, False/) // window style 0 = hidden
  assert.ok(vbs.includes('"C:\\Program Files\\nodejs\\node.exe"'))
  const plist = autostart.macPlist('/usr/local/bin/node', '/Users/a/l&r.js', '/tmp/x.log')
  assert.match(plist, /RunAtLoad/)
  assert.ok(plist.includes('l&amp;r.js'))
  const unit = autostart.systemdUnit('/usr/bin/node', '/home/a/launcher.js')
  assert.match(unit, /ExecStart="\/usr\/bin\/node" "\/home\/a\/launcher.js"/)
  assert.match(unit, /WantedBy=default.target/)
  assert.match(autostart.xdgDesktop('/usr/bin/node', '/home/a/l.js'), /NoDisplay=true/)
  assert.equal(autostart.targets('win32', 'C:\\u', { APPDATA: 'C:\\u\\AppData\\Roaming' }).kind, 'windows')
  assert.match(autostart.targets('darwin', '/Users/a', {}).file.replace(/\\/g, '/'), /Library\/LaunchAgents\/com\.opencode\.connect\.plist$/)
  assert.match(autostart.targets('linux', '/home/a', {}).unit.replace(/\\/g, '/'), /\.config\/systemd\/user\/opencode-connect\.service$/)
})

test('phone MCP entry is merged into the opencode config and removed again without touching other entries', () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const { registerOpencodeMcp, unregisterOpencodeMcp } = require('./connect.js')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-cfg-'))
  const previous = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = dir
  try {
    const file = path.join(dir, 'opencode', 'opencode.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ model: 'x', mcp: { other: { type: 'remote', url: 'http://a' } } }))
    registerOpencodeMcp('/tmp/phone-mcp.js')
    let cfg = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.equal(cfg.model, 'x')
    assert.ok(cfg.mcp.other && cfg.mcp.phone)
    assert.deepEqual(cfg.mcp.phone.command, ['node', '/tmp/phone-mcp.js'])
    assert.equal(unregisterOpencodeMcp(), true)
    cfg = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.ok(cfg.mcp.other && !cfg.mcp.phone)
    assert.equal(unregisterOpencodeMcp(), false)
    fs.writeFileSync(file, '{ broken')
    assert.match(registerOpencodeMcp('/tmp/p.js'), /could not be parsed/)
    assert.equal(fs.readFileSync(file, 'utf8'), '{ broken')
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previous
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('the free cloud model is merged in, keeps the user default, and is removed again', () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const { registerFreeModel, unregisterFreeModel } = require('./connect.js')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-free-'))
  const previous = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = dir
  const file = path.join(dir, 'opencode', 'opencode.json')
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'))
  try {
    // empty config: provider added and becomes the default model
    registerFreeModel()
    assert.equal(read().model, 'pollinations/openai-fast')
    assert.equal(read().provider.pollinations.options.baseURL, 'https://text.pollinations.ai/openai')
    assert.equal(unregisterFreeModel(), true)
    assert.equal(read().model, undefined)
    // an existing default and other providers are left alone
    fs.writeFileSync(file, JSON.stringify({ model: 'mine/x', provider: { mine: { name: 'm' } } }))
    registerFreeModel()
    assert.equal(read().model, 'mine/x')
    assert.ok(read().provider.mine && read().provider.pollinations)
    assert.equal(unregisterFreeModel(), true)
    assert.equal(read().model, 'mine/x')
    assert.ok(read().provider.mine && !read().provider.pollinations)
    assert.equal(unregisterFreeModel(), false)
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previous
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
