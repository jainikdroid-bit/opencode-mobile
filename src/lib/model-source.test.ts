import test from "node:test"
import assert from "node:assert/strict"
import { isLocalUrl, isLocalProvider, matchesSource, countBySource } from "./model-source.ts"

test("loopback, LAN, tailscale and .local hosts are local", () => {
  for (const url of [
    "http://127.0.0.1:8080/v1",
    "http://localhost:11434",
    "http://[::1]:8080",
    "http://192.168.1.50:1234/v1",
    "http://10.0.0.7/v1",
    "http://172.20.1.1:9000",
    "http://100.92.64.0:8080",
    "http://home.taildc7512.ts.net:8080",
    "http://my-pc.local:8080",
  ]) {
    assert.equal(isLocalUrl(url), true, url)
  }
})

test("public hosts and junk are not local", () => {
  for (const url of ["https://openrouter.ai/api/v1", "https://api.openai.com", "http://8.8.8.8", "http://172.32.0.1", "", "not a url"]) {
    assert.equal(isLocalUrl(url), false, url)
  }
  assert.equal(isLocalUrl(undefined), false)
})

test("provider is local only if every endpoint is; ids are the fallback", () => {
  assert.equal(isLocalProvider("x", ["http://127.0.0.1:8080/v1", "http://127.0.0.1:8080/v1"]), true)
  assert.equal(isLocalProvider("x", ["http://127.0.0.1:8080/v1", "https://api.x.com"]), false)
  assert.equal(isLocalProvider("llama.cpp"), true)
  assert.equal(isLocalProvider("ollama"), true)
  assert.equal(isLocalProvider("openrouter"), false)
  // a known cloud URL beats a local-sounding id
  assert.equal(isLocalProvider("ollama-cloud", ["https://ollama.com/v1"]), false)
})

test("filtering and counting by source", () => {
  const providers = [
    { id: "llama.cpp", local: true, models: [1, 2] },
    { id: "openrouter", local: false, models: [1, 2, 3] },
    { id: "rurout", models: [1] },
  ]
  assert.deepEqual(providers.filter((p) => matchesSource(p, "local")).map((p) => p.id), ["llama.cpp"])
  assert.deepEqual(providers.filter((p) => matchesSource(p, "cloud")).map((p) => p.id), ["openrouter", "rurout"])
  assert.equal(providers.filter((p) => matchesSource(p, "all")).length, 3)
  assert.deepEqual(countBySource(providers), { all: 6, local: 2, cloud: 4 })
})
