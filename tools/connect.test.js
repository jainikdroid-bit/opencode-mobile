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
