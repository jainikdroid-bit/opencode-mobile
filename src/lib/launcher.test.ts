import test from "node:test"
import assert from "node:assert/strict"
import { launcherUrl, interpretStart, canStartFromPhone } from "./launcher.ts"

test("launcher url keeps the host and swaps the port", () => {
  assert.equal(launcherUrl("http://100.92.64.0:4096", 4095), "http://100.92.64.0:4095")
  assert.equal(launcherUrl("https://my-pc.tail1234.ts.net/", 4095), "https://my-pc.tail1234.ts.net:4095")
  assert.equal(launcherUrl("http://[fd7a::1]:4096", 4095), "http://[fd7a::1]:4095")
  assert.equal(launcherUrl("not a url", 4095), null)
  assert.equal(launcherUrl("http://a:4096", 0), null)
  assert.equal(launcherUrl("http://a:4096", 70000), null)
})

test("start responses are interpreted", () => {
  assert.deepEqual(interpretStart(200, { ok: true, server: { running: true, healthy: true } }), { kind: "started" })
  assert.deepEqual(interpretStart(401, {}), { kind: "failed", reason: "unauthorized" })
  assert.equal(interpretStart(500, { ok: false, error: "the server did not become healthy in 30 s" }).kind, "failed")
  const timeout = interpretStart(500, { ok: false, error: "the server did not become healthy in 30 s" })
  assert.equal(timeout.kind === "failed" && timeout.reason, "timeout")
  const noPw = interpretStart(500, { ok: false, error: "no password saved yet: run the installer once" })
  assert.equal(noPw.kind === "failed" && noPw.reason, "no-server")
  const rate = interpretStart(429, { ok: false, error: "too many attempts" })
  assert.equal(rate.kind === "failed" && rate.reason, "error")
  assert.equal(interpretStart(200, { ok: true, server: { running: true, healthy: false } }).kind, "failed")
  assert.equal(interpretStart(200, null).kind, "failed")
})

test("only connections paired with a launcher offer the start button", () => {
  assert.equal(canStartFromPhone({ launcherPort: 4095 }), true)
  assert.equal(canStartFromPhone({}), false)
  assert.equal(canStartFromPhone(null), false)
  assert.equal(canStartFromPhone({ launcherPort: 0 }), false)
})

test("tunnel mode puts the launcher under a path of the public address", () => {
  assert.equal(launcherUrl("https://a-b.trycloudflare.com/", 4095, true), "https://a-b.trycloudflare.com/__oc/launcher")
  assert.equal(launcherUrl("http://100.1.2.3:4096", 4095), "http://100.1.2.3:4095")
})
