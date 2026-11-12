import test from "node:test"
import assert from "node:assert/strict"
import { parsePairingLink, buildPairing } from "./pairing.ts"

test("parses a full pairing link", () => {
  const info = parsePairingLink(
    "opencode://connect?url=http%3A%2F%2F100.92.64.0%3A4096&password=s3cr%2Bet%21&name=Home%20PC",
  )
  assert.deepEqual(info, { url: "http://100.92.64.0:4096", password: "s3cr+et!", name: "Home PC" })
})

test("name defaults to host and password is optional", () => {
  const info = parsePairingLink("opencode://connect?url=http%3A%2F%2Fmy-pc.tailnet.ts.net%3A4096")
  assert.deepEqual(info, { url: "http://my-pc.tailnet.ts.net:4096", password: undefined, name: "my-pc.tailnet.ts.net:4096" })
})

test("rejects other schemes, paths, credentials and bad ports", () => {
  assert.equal(parsePairingLink("https://example.com"), null)
  assert.equal(parsePairingLink("opencode://other?url=http%3A%2F%2Fa%3A1"), null)
  assert.equal(parsePairingLink("opencode://connect?url=ftp%3A%2F%2Fa%3A21"), null)
  assert.equal(parsePairingLink("opencode://connect?url=http%3A%2F%2Fa%3A4096%2Fpath"), null)
  assert.equal(parsePairingLink("opencode://connect?url=http%3A%2F%2Fuser%3Apw%40a%3A4096"), null)
  assert.equal(parsePairingLink("opencode://connect?url=http%3A%2F%2Fa%3A99999"), null)
  assert.equal(parsePairingLink("opencode://connect"), null)
  assert.equal(parsePairingLink("opencode://connect?url=%E0%A4%A"), null)
})

test("buildPairing trims, strips trailing slash and caps the name", () => {
  const info = buildPairing(" http://10.0.2.2:4096/ ", "", "x".repeat(100))
  assert.equal(info?.url, "http://10.0.2.2:4096")
  assert.equal(info?.password, undefined)
  assert.equal(info?.name.length, 40)
  assert.equal(buildPairing("", "p", "n"), null)
})
