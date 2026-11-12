import test from "node:test"
import assert from "node:assert/strict"
import {
  GUIDE_STEPS, WINDOWS_COMMAND, UNIX_COMMAND, commandFor, clampStep, isLastStep, shouldAutoShowGuide,
} from "./guide.ts"

test("commands point at this project's installers", () => {
  assert.match(WINDOWS_COMMAND, /opencode-connect\.ps1/)
  assert.match(UNIX_COMMAND, /opencode-connect\.sh/)
  assert.equal(commandFor("windows"), WINDOWS_COMMAND)
  assert.equal(commandFor("unix"), UNIX_COMMAND)
  assert.ok(!WINDOWS_COMMAND.includes("\n") && !UNIX_COMMAND.includes("\n"), "one line, pasteable")
})

test("step index is clamped and the last step is recognised", () => {
  assert.equal(GUIDE_STEPS.length, 3)
  assert.equal(clampStep(-4), 0)
  assert.equal(clampStep(99), GUIDE_STEPS.length - 1)
  assert.equal(clampStep(1.9), 1)
  assert.equal(clampStep(Number.NaN), 0)
  assert.equal(isLastStep(0), false)
  assert.equal(isLastStep(GUIDE_STEPS.length - 1), true)
})

test("the guide auto-opens once, only for people without a server", () => {
  assert.equal(shouldAutoShowGuide({ loaded: true, done: false, hasConnection: false }), true)
  assert.equal(shouldAutoShowGuide({ loaded: false, done: false, hasConnection: false }), false) // flag not read yet
  assert.equal(shouldAutoShowGuide({ loaded: true, done: true, hasConnection: false }), false) // skipped or finished
  assert.equal(shouldAutoShowGuide({ loaded: true, done: false, hasConnection: true }), false) // already set up
})
