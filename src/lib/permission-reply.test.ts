import test from "node:test"
import assert from "node:assert/strict"
import { replyFromAction, bannerState, sessionIdFromPath, describePermission, ACTION_ALLOW, ACTION_DENY } from "./permission-reply.ts"

const P = (id: string, sessionID: string) => ({ id, sessionID, permission: "bash", patterns: ["ls -la"], metadata: {} })

test("notification buttons map to once/reject; always is never offered", () => {
  assert.equal(replyFromAction(ACTION_ALLOW), "once")
  assert.equal(replyFromAction(ACTION_DENY), "reject")
  assert.equal(replyFromAction("expo.modules.notifications.actions.DEFAULT"), null)
})

test("banner skips requests already shown in the open chat and counts the rest", () => {
  const pending = { a: [P("1", "a"), P("2", "a")], b: [P("3", "b")] }
  assert.deepEqual(bannerState(pending, null), { current: P("1", "a"), more: 2 })
  assert.deepEqual(bannerState(pending, "a"), { current: P("3", "b"), more: 0 })
  assert.equal(bannerState({ a: [P("1", "a")] }, "a"), null)
  assert.equal(bannerState({}, null), null)
})

test("session id is read from the route", () => {
  assert.equal(sessionIdFromPath("/session/ses_1"), "ses_1")
  assert.equal(sessionIdFromPath("/session/ses_1?directory=%2Fx"), "ses_1")
  assert.equal(sessionIdFromPath("/"), null)
  assert.equal(sessionIdFromPath("/connections"), null)
})

test("description is compact", () => {
  assert.equal(describePermission({ permission: "bash", patterns: ["ls", "pwd"] }), "bash: ls, pwd")
  assert.equal(describePermission({ permission: "edit", patterns: [] }), "edit")
  assert.ok(describePermission({ permission: "bash", patterns: ["x".repeat(500)] }, 50).length === 50)
})
