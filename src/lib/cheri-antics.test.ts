import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ANTIC_MS,
  anticPool,
  enterAntic,
  faceFor,
  nextDelayMs,
  pickAntic,
  tapAntic,
  type Antic,
  type Mood,
} from "./cheri-antics.ts"

const MOODS: Mood[] = ["idle", "thinking", "working", "writing", "loading", "success", "error", "offline"]

test("idle has plenty of antics and loading has none", () => {
  assert.ok(anticPool("idle").length >= 8)
  assert.equal(anticPool("loading").length, 0)
  assert.equal(pickAntic("loading", () => 0.5), null)
  assert.equal(nextDelayMs("loading", () => 0.5), null)
})

test("every pooled antic has a duration and a face", () => {
  for (const mood of MOODS) {
    for (const antic of anticPool(mood)) {
      assert.ok(ANTIC_MS[antic] > 0, antic)
      assert.ok(faceFor(mood, antic).eyes, antic)
    }
  }
})

test("pickAntic stays inside the mood's pool and never repeats the last one", () => {
  for (const mood of MOODS) {
    const pool = anticPool(mood)
    for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
      for (const last of [null, ...pool] as (Antic | null)[]) {
        const picked = pickAntic(mood, () => r, last)
        if (pool.length === 0) {
          assert.equal(picked, null)
          continue
        }
        assert.ok(picked && pool.includes(picked))
        if (pool.length > 1 && last) assert.notEqual(picked, last)
      }
    }
  }
})

test("delays fall inside a sane range", () => {
  for (const mood of MOODS) {
    for (const r of [0, 0.5, 1]) {
      const delay = nextDelayMs(mood, () => r)
      if (delay === null) continue
      assert.ok(delay >= 3000 && delay <= 16000, `${mood} ${delay}`)
    }
  }
})

test("entering success or error plays a scene, staying in a mood does not", () => {
  assert.equal(enterAntic("working", "success"), "celebrate")
  assert.equal(enterAntic("thinking", "error"), "storm")
  assert.equal(enterAntic("success", "success"), null)
  assert.equal(enterAntic("idle", "working"), null)
})

test("taps escalate from a giggle to dizzy", () => {
  assert.equal(tapAntic(1), "giggle")
  assert.equal(tapAntic(2), "hearts")
  assert.equal(tapAntic(4), "pout")
  assert.equal(tapAntic(7), "dizzy")
  assert.equal(tapAntic(30), "dizzy")
})

test("an antic's face overrides the mood's face", () => {
  assert.equal(faceFor("offline", null).eyes, "sleepy")
  assert.equal(faceFor("offline", "sneeze").eyes, "squeeze")
  assert.equal(faceFor("idle", "dizzy").eyes, "spiral")
})
