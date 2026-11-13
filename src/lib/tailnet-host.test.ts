import { test } from "node:test"
import assert from "node:assert/strict"
import { isTailnetHost, tailnetTarget } from "./tailnet-host.ts"

test("recognises tailnet addresses only", () => {
  assert.equal(isTailnetHost("100.92.64.0"), true)
  assert.equal(isTailnetHost("100.127.255.255"), true)
  assert.equal(isTailnetHost("pc.tail1234.ts.net"), true)
  assert.equal(isTailnetHost("100.63.0.1"), false)
  assert.equal(isTailnetHost("100.128.0.1"), false)
  assert.equal(isTailnetHost("192.168.1.5"), false)
  assert.equal(isTailnetHost("example.com"), false)
})

test("rewrites a tailnet URL to the local forward and keeps path and query", () => {
  const t = tailnetTarget("http://100.92.64.0:4096/session?x=1")
  assert.ok(t)
  assert.equal(t.target, "100.92.64.0:4096")
  assert.equal(t.rewrite(40123), "http://127.0.0.1:40123/session?x=1")
})

test("defaults the port and ignores non-tailnet or https URLs", () => {
  assert.equal(tailnetTarget("http://pc.tail1234.ts.net/x")?.target, "pc.tail1234.ts.net:80")
  assert.equal(tailnetTarget("http://192.168.1.5:4096/"), null)
  assert.equal(tailnetTarget("https://pc.tail1234.ts.net/"), null)
  assert.equal(tailnetTarget("opencode://connect"), null)
})
