import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createLanRouter, isPrivateV4, lanRouteFor, type LanRoute } from "./lan-route.ts"

const route: LanRoute = { remoteHost: "100.64.0.7", lanHost: "192.168.1.20", launcherPort: 4095, password: "secret-password" }
const sha = async (text: string) => createHash("sha256").update(text).digest("hex")

function router(answer: (url: string) => { status: number; body: unknown } | null) {
  let clock = 0
  const asked: string[] = []
  const r = createLanRouter({
    fetchJson: async (url) => {
      asked.push(url)
      return answer(url)
    },
    sha256Hex: sha,
    nonce: () => "abcdefabcdefabcdef",
    now: () => clock,
  })
  return { r, asked, tick: (ms: number) => (clock += ms) }
}

const honest = (url: string) => {
  const nonce = new URL(url).searchParams.get("n") ?? ""
  return { status: 200, body: { ok: true, proof: createHash("sha256").update(`${nonce}:${route.password}`).digest("hex") } }
}

test("private IPv4 only", () => {
  assert.equal(isPrivateV4("192.168.1.20"), true)
  assert.equal(isPrivateV4("10.0.0.1"), true)
  assert.equal(isPrivateV4("172.20.0.1"), true)
  assert.equal(isPrivateV4("172.32.0.1"), false)
  assert.equal(isPrivateV4("100.64.0.7"), false)
  assert.equal(isPrivateV4("8.8.8.8"), false)
  assert.equal(isPrivateV4("192.168.1.300"), false)
  assert.equal(isPrivateV4("192.168.1"), false)
})

test("only the saved host is rewritten, keeping port and path", () => {
  assert.deepEqual(lanRouteFor("http://100.64.0.7:4096/session?x=1", [route])?.url, "http://192.168.1.20:4096/session?x=1")
  assert.equal(lanRouteFor("http://100.64.0.8:4096/", [route]), null)
  assert.equal(lanRouteFor("https://100.64.0.7:4096/", [route]), null)
})

test("goes home when the computer proves who it is, and remembers it for a while", async () => {
  const { r, asked, tick } = router(honest)
  r.setRoutes([route])
  assert.equal(await r.rewrite("http://100.64.0.7:4096/global/health"), "http://192.168.1.20:4096/global/health")
  assert.equal(await r.rewrite("http://100.64.0.7:4095/status"), "http://192.168.1.20:4095/status")
  assert.equal(asked.length, 1)
  assert.match(asked[0], /^http:\/\/192\.168\.1\.20:4095\/hello\?n=/)
  tick(31_000)
  await r.rewrite("http://100.64.0.7:4096/")
  assert.equal(asked.length, 2)
})

test("a stranger on the same address never gets the request", async () => {
  const { r } = router(() => ({ status: 200, body: { ok: true, proof: "0".repeat(64) } }))
  r.setRoutes([route])
  assert.equal(await r.rewrite("http://100.64.0.7:4096/"), null)
})

test("no answer keeps the usual address and is retried after a network change", async () => {
  let home = false
  const { r, asked } = router((url) => (home ? honest(url) : null))
  r.setRoutes([route])
  assert.equal(await r.rewrite("http://100.64.0.7:4096/"), null)
  assert.equal(await r.rewrite("http://100.64.0.7:4096/"), null)
  assert.equal(asked.length, 1)
  home = true
  r.networkChanged()
  assert.equal(await r.rewrite("http://100.64.0.7:4096/"), "http://192.168.1.20:4096/")
})

test("parallel requests share one check; bad routes are ignored", async () => {
  const { r, asked } = router(honest)
  r.setRoutes([route, { ...route, remoteHost: "100.1.1.1", lanHost: "8.8.8.8" }])
  await Promise.all([r.rewrite("http://100.64.0.7:4096/a"), r.rewrite("http://100.64.0.7:4096/b")])
  assert.equal(asked.length, 1)
  assert.equal(await r.rewrite("http://100.1.1.1:4096/"), null)
})
