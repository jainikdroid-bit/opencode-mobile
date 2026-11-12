import test from "node:test"
import assert from "node:assert/strict"
import { parseNtfyLatest, addressChange, isValidTopic, tunnelLauncherUrl, tunnelBridgeUrl } from "./tunnel-discovery.ts"
import { buildPairing, parsePairingLink } from "./pairing.ts"

const line = (time: number, message: string, event = "message") => JSON.stringify({ time, event, message })

test("the newest valid announcement wins; junk is ignored", () => {
  const body = [line(1, "https://old-one.trycloudflare.com"), line(5, "https://new-one.trycloudflare.com/"), line(9, "https://evil.example.com"), "not json", line(7, "hello", "open")].join("\n")
  assert.equal(parseNtfyLatest(body), "https://new-one.trycloudflare.com")
  assert.equal(parseNtfyLatest(""), null)
})

test("address change is reported only when different", () => {
  assert.equal(addressChange("https://a.trycloudflare.com", "https://a.trycloudflare.com"), null)
  assert.equal(addressChange("https://a.trycloudflare.com/", "https://a.trycloudflare.com"), null)
  assert.equal(addressChange("https://a.trycloudflare.com", "https://b.trycloudflare.com"), "https://b.trycloudflare.com")
  assert.equal(addressChange("https://a.trycloudflare.com", null), null)
})

test("topics and tunnel paths", () => {
  assert.equal(isValidTopic("ocx-4d606d4ef3c828d64263d782"), true)
  assert.equal(isValidTopic("../x"), false)
  assert.equal(isValidTopic(undefined), false)
  assert.equal(tunnelLauncherUrl("https://a.trycloudflare.com/"), "https://a.trycloudflare.com/__oc/launcher")
  assert.equal(tunnelBridgeUrl("https://a.trycloudflare.com"), "https://a.trycloudflare.com/__oc/bridge")
})

test("pairing link carries the topic only when valid", () => {
  const ok = parsePairingLink("opencode://connect?url=https%3A%2F%2Fa-b.trycloudflare.com&password=p&name=PC&launcher=4095&topic=ocx-4d606d4ef3c828d64263d782")
  assert.equal(ok?.tunnelTopic, "ocx-4d606d4ef3c828d64263d782")
  assert.equal(ok?.url, "https://a-b.trycloudflare.com")
  assert.equal(buildPairing("https://a.b", "p", "n", "4095", "bad topic!")?.tunnelTopic, undefined)
  assert.equal(buildPairing("http://1.2.3.4:4096", "p", "n")?.tunnelTopic, undefined)
})
