'use strict'
// Tunnel mode: keeps a free Cloudflare "quick tunnel" (cloudflared, outbound HTTPS only, no account, no open ports)
// pointed at the local gateway, and tells the phone the current address.
//
// A quick tunnel gets a new random address every time it starts. The phone is told through a private ntfy.sh topic
// (a long random name known only to this computer and the paired phone); the message holds only the address,
// never the password.

const https = require('node:https')
const { spawn } = require('node:child_process')

const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

function extractTunnelUrl(text) {
  const m = URL_RE.exec(String(text))
  return m ? m[0].toLowerCase() : null
}

/** Next restart delay: 2 s, doubling, capped at 60 s. */
function backoff(attempt) {
  return Math.min(60_000, 2000 * 2 ** Math.max(0, attempt))
}

const TOPIC_RE = /^[A-Za-z0-9_-]{16,64}$/
const isValidTopic = (t) => TOPIC_RE.test(String(t))

function publishUrl(topic, url) {
  return new Promise((resolve) => {
    if (!isValidTopic(topic)) return resolve(false)
    const req = https.request({ host: 'ntfy.sh', path: `/${topic}`, method: 'POST', timeout: 10_000, headers: { Title: 'OpenCode address', 'Content-Length': Buffer.byteLength(url) } }, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 300)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.end(url)
  })
}

/**
 * Runs cloudflared until stop() is called; restarts it when it exits. onUrl(url) fires for each new address.
 * `spawnFn` is injectable for tests.
 */
function startTunnel({ binary, targetPort, onUrl, spawnFn = spawn, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let child = null
  let stopped = false
  let attempt = 0

  async function loop() {
    while (!stopped) {
      let gotUrl = false
      await new Promise((resolve) => {
        child = spawnFn(binary, ['tunnel', '--url', `http://127.0.0.1:${targetPort}`, '--no-autoupdate'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
        const scan = (chunk) => {
          const url = extractTunnelUrl(chunk.toString())
          if (url && !gotUrl) { gotUrl = true; onUrl(url) }
        }
        child.stdout && child.stdout.on('data', scan)
        child.stderr && child.stderr.on('data', scan)
        child.on('error', () => resolve())
        child.on('exit', () => resolve())
      })
      if (stopped) break
      attempt = gotUrl ? 0 : attempt + 1
      await sleep(backoff(attempt))
    }
  }
  void loop()
  return { stop() { stopped = true; if (child) child.kill() } }
}

module.exports = { extractTunnelUrl, backoff, isValidTopic, publishUrl, startTunnel }
