import { test } from "node:test"
import assert from "node:assert/strict"
import { formatCode, interpretPairReply, isCompleteCode, lanCandidates, normalizeCode, offerName, parsePairAddress } from "./pair-code.ts"

test("code keeps six digits whatever is typed around them", () => {
  assert.equal(normalizeCode("482 913"), "482913")
  assert.equal(normalizeCode("48-29-13 77"), "482913")
  assert.equal(isCompleteCode(normalizeCode("4829")), false)
  assert.equal(isCompleteCode("482913"), true)
  assert.equal(formatCode("482913"), "482 913")
  assert.equal(formatCode("48"), "48")
})

test("computer address accepts a host, a host with port, or a pasted URL", () => {
  assert.deepEqual(parsePairAddress(" 100.92.64.1 "), { host: "100.92.64.1", port: 4095 })
  assert.deepEqual(parsePairAddress("192.168.1.20:5999"), { host: "192.168.1.20", port: 5999 })
  assert.deepEqual(parsePairAddress("http://My-PC.tail1234.ts.net:4095/pair"), { host: "my-pc.tail1234.ts.net", port: 4095 })
  assert.equal(parsePairAddress(""), null)
  assert.equal(parsePairAddress("..."), null)
  assert.equal(parsePairAddress("host:99999"), null)
  assert.equal(parsePairAddress("user@host"), null)
})

test("home network search covers the phone's own /24 and nothing else", () => {
  const hosts = lanCandidates(["127.0.0.1/8", "26.26.26.1/30", "100.92.64.5/32", "192.168.1.34/24", "fe80::1/64"])
  assert.equal(hosts.length, 253)
  assert.ok(hosts.includes("192.168.1.1") && hosts.includes("192.168.1.254"))
  assert.ok(!hosts.includes("192.168.1.34"))
  assert.deepEqual(lanCandidates(["8.8.8.8/24"]), [])
  assert.equal(lanCandidates(["10.0.0.5/8", "10.0.0.6/8", "192.168.1.2/24", "172.16.4.4/16"]).length, 506)
})

test("a waiting code is recognised only from the exact answer", () => {
  assert.equal(offerName(200, { ok: true, pairing: true, name: "My PC" }), "My PC")
  assert.equal(offerName(200, { ok: true, pairing: true }), "")
  assert.equal(offerName(404, { ok: false }), null)
  assert.equal(offerName(200, { ok: true }), null)
  assert.equal(offerName(200, "<html>"), null)
})

test("the right code becomes a pairing for the same host", () => {
  const target = { host: "100.92.64.1", port: 4095 }
  const out = interpretPairReply(target, 200, { ok: true, name: "My PC", password: "secret-value", port: 4096, launcherPort: 4095 })
  assert.deepEqual(out, { kind: "ok", url: "http://100.92.64.1:4096", password: "secret-value", name: "My PC", launcherPort: 4095 })
})

test("wrong, missing and broken answers are told apart", () => {
  const target = { host: "192.168.1.20", port: 4095 }
  assert.deepEqual(interpretPairReply(target, 403, { ok: false, left: 3 }), { kind: "wrong", left: 3 })
  assert.deepEqual(interpretPairReply(target, 403, {}), { kind: "wrong", left: 0 })
  assert.deepEqual(interpretPairReply(target, 404, { ok: false }), { kind: "inactive" })
  assert.deepEqual(interpretPairReply(target, 401, null), { kind: "inactive" })
  assert.equal(interpretPairReply(target, 500, { ok: false }).kind, "failed")
  assert.equal(interpretPairReply(target, 200, { ok: true, port: 4096 }).kind, "failed")
  assert.equal(interpretPairReply(target, 200, { ok: true, password: "x", port: 0 }).kind, "failed")
})
