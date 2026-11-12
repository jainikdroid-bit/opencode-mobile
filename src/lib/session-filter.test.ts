import test from "node:test"
import assert from "node:assert/strict"
import { filterSessions, splitPinned, togglePin, parsePinned } from "./session-filter.ts"

const S = [
  { id: "ses_1", title: "Fix login bug", directory: "/home/a/web" },
  { id: "ses_2", title: "Router notes", directory: "/home/a/infra" },
  { id: "ses_3", title: undefined, directory: "/home/a/web" },
] as any[]

test("empty query keeps everything", () => assert.equal(filterSessions(S, "  ").length, 3))
test("matches title, folder and id, all words required", () => {
  assert.deepEqual(filterSessions(S, "LOGIN").map((s) => s.id), ["ses_1"])
  assert.deepEqual(filterSessions(S, "web").map((s) => s.id), ["ses_1", "ses_3"])
  assert.deepEqual(filterSessions(S, "web fix").map((s) => s.id), ["ses_1"])
  assert.deepEqual(filterSessions(S, "ses_2").map((s) => s.id), ["ses_2"])
  assert.equal(filterSessions(S, "zzz").length, 0)
})
test("pinned go first in pin order; unknown pins are ignored", () => {
  const r = splitPinned(S, ["ses_3", "gone", "ses_1"])
  assert.deepEqual(r.pinned.map((s) => s.id), ["ses_3", "ses_1"])
  assert.deepEqual(r.rest.map((s) => s.id), ["ses_2"])
})
test("togglePin adds first, removes, and does not mutate", () => {
  const base = ["a", "b"]
  assert.deepEqual(togglePin(base, "c"), ["c", "a", "b"])
  assert.deepEqual(togglePin(base, "a"), ["b"])
  assert.deepEqual(base, ["a", "b"])
})
test("parsePinned survives garbage", () => {
  assert.deepEqual(parsePinned('["x",1,"y"]'), ["x", "y"])
  assert.deepEqual(parsePinned("{oops"), [])
  assert.deepEqual(parsePinned(null), [])
})
