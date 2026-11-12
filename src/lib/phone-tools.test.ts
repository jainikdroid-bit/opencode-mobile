import test from "node:test"
import assert from "node:assert/strict"
import { decide, checkArgs, bridgeUrl, pushAudit, parsePhoneSettings, DEFAULT_PHONE_SETTINGS, MAX_TEXT } from "./phone-tools.ts"

test("everything is denied until switched on", () => {
  assert.equal(decide(DEFAULT_PHONE_SETTINGS, "phone_info"), "deny")
  assert.equal(decide({ enabled: true, allowed: {} }, "phone_info"), "deny")
  assert.equal(decide({ enabled: false, allowed: { phone_info: true } }, "phone_info"), "deny")
  assert.equal(decide({ enabled: true, allowed: { phone_info: true } }, "phone_info"), "allow")
})
test("sensitive tools ask every time; unknown tools are denied", () => {
  const s = { enabled: true, allowed: { phone_location: true, phone_photo: true, phone_clipboard_read: true } }
  assert.equal(decide(s, "phone_location"), "ask")
  assert.equal(decide(s, "phone_photo"), "ask")
  assert.equal(decide(s, "phone_clipboard_read"), "ask")
  assert.equal(decide({ enabled: true, allowed: {} }, "rm_rf"), "deny")
})
test("arguments are validated and trimmed", () => {
  assert.deepEqual(checkArgs("phone_notify", { body: "hi" }), { ok: true, args: { title: "", body: "hi" } })
  assert.equal(checkArgs("phone_speak", {}).ok, false)
  assert.equal(checkArgs("phone_speak", { text: 5 }).ok, false)
  const long = checkArgs("phone_clipboard_write", { text: "x".repeat(MAX_TEXT + 50) })
  assert.ok(long.ok && long.args.text.length === MAX_TEXT)
  assert.deepEqual(checkArgs("phone_location", null), { ok: true, args: {} })
})
test("bridge url sits one port below the launcher on the same host", () => {
  assert.equal(bridgeUrl("http://100.1.2.3:4096", 4095), "http://100.1.2.3:4094")
  assert.equal(bridgeUrl("http://pc.tail.ts.net:4096/", 4095), "http://pc.tail.ts.net:4094")
  assert.equal(bridgeUrl("http://100.1.2.3:4096", undefined), null)
  assert.equal(bridgeUrl("nonsense", 4095), null)
})
test("audit log is newest-first and capped, without mutation", () => {
  const base = [{ time: 1, tool: "a", outcome: "done" as const }]
  const next = pushAudit(base, { time: 2, tool: "b", outcome: "declined" }, 2)
  assert.deepEqual(next.map((e) => e.tool), ["b", "a"])
  assert.equal(pushAudit(next, { time: 3, tool: "c", outcome: "off" }, 2).length, 2)
  assert.equal(base.length, 1)
})
test("stored settings are sanitised", () => {
  assert.deepEqual(parsePhoneSettings('{"enabled":true,"allowed":{"phone_info":true,"evil":true,"phone_photo":"yes"}}'), { enabled: true, allowed: { phone_info: true } })
  assert.deepEqual(parsePhoneSettings("{bad"), DEFAULT_PHONE_SETTINGS)
  assert.deepEqual(parsePhoneSettings(null), DEFAULT_PHONE_SETTINGS)
})
