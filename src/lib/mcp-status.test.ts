import test from "node:test"
import assert from "node:assert/strict"
import { toMcpRows, normalizeState, isOn } from "./mcp-status.ts"

test("rows are sorted and states normalised", () => {
  const rows = toMcpRows({
    phone: { status: "connected" },
    github: { status: "disabled" },
    exa: { status: "needs_client_registration" },
    broken: { status: "failed", error: "boom" },
    weird: { status: "something-new" },
  })
  assert.deepEqual(rows.map((r) => r.name), ["broken", "exa", "github", "phone", "weird"])
  assert.deepEqual(rows.map((r) => r.state), ["failed", "needs_auth", "disabled", "connected", "other"])
  assert.equal(rows[0].error, "boom")
})

test("empty or missing map gives no rows", () => {
  assert.deepEqual(toMcpRows(null), [])
  assert.deepEqual(toMcpRows(undefined), [])
  assert.deepEqual(toMcpRows({}), [])
})

test("switch is on for everything except disabled/other", () => {
  assert.equal(isOn(normalizeState("connected")), true)
  assert.equal(isOn(normalizeState("failed")), true)
  assert.equal(isOn(normalizeState("disabled")), false)
  assert.equal(isOn(normalizeState("zzz")), false)
})
