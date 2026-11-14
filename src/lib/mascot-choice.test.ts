import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_MASCOT, MASCOT_KINDS, isMascotKind, resolveMascot } from "./mascot-choice.ts"

test("Cheri is the default mascot", () => {
  assert.equal(DEFAULT_MASCOT, "cheri")
  assert.ok(MASCOT_KINDS.includes(DEFAULT_MASCOT))
})

test("RIG stays selectable", () => {
  assert.ok(isMascotKind("rig"))
  assert.equal(resolveMascot("rig"), "rig")
})

test("unknown or missing stored values fall back to the default", () => {
  for (const value of [undefined, null, "", "robot", 3, {}]) {
    assert.equal(isMascotKind(value), false)
    assert.equal(resolveMascot(value), DEFAULT_MASCOT)
  }
})
