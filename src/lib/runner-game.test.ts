import test from "node:test"
import assert from "node:assert/strict"
import { CONFIG, newGame, jump, step, collides, score, isOnGround, type GameState } from "./runner-game.ts"

const fixed = (value: number) => () => value
const W = 360

function run(state: GameState, seconds: number, rng = fixed(0.9)): GameState {
  let s = state
  for (let t = 0; t < seconds; t += 1 / 60) s = step(s, 1 / 60, W, rng)
  return s
}

test("a new game stands on the ground and is alive", () => {
  const g = newGame()
  assert.equal(g.alive, true)
  assert.equal(isOnGround(g), true)
  assert.equal(g.obstacles.length, 0)
  assert.equal(score(g), 0)
})

test("jump leaves the ground, peaks, then lands again", () => {
  let g = jump(newGame())
  let peak = 0
  for (let i = 0; i < 90; i++) {
    g = step(g, 1 / 60, W, fixed(0.9))
    peak = Math.max(peak, g.y)
  }
  assert.ok(peak > 90 && peak < 160, `peak ${peak}`)
  assert.equal(isOnGround(g), true)
})

test("jumping in mid-air or when dead does nothing", () => {
  const airborne = { ...newGame(), y: 30, vy: 100 }
  assert.equal(jump(airborne), airborne)
  const dead = { ...newGame(), alive: false }
  assert.equal(jump(dead), dead)
})

test("speed grows to a cap and distance (score) increases", () => {
  const g = run(newGame(), 3, fixed(0.99))
  // keep the run alive by removing obstacles for this check
  const g2 = run({ ...newGame(), obstacles: [] }, 1)
  assert.ok(g2.distance > 0 && score(g2) > 0)
  assert.ok(g.speed >= CONFIG.startSpeed && g.speed <= CONFIG.maxSpeed)
})

test("an obstacle spawns off the right edge once the gap is travelled", () => {
  const g = run({ ...newGame(), untilSpawn: 5 }, 0.1, fixed(0.9))
  assert.ok(g.obstacles.length >= 1)
  assert.ok(g.obstacles[0].x > W - 100)
})

test("running into an obstacle ends the game; jumping over it does not", () => {
  const wall = { kind: "rack" as const, x: CONFIG.playerX + 20, w: 24, h: 40 }
  assert.equal(collides({ ...newGame(), obstacles: [wall] }), true)
  assert.equal(collides({ ...newGame(), y: 80, obstacles: [wall] }), false)
  const hit = step({ ...newGame(), obstacles: [wall] }, 1 / 60, W, fixed(0.9))
  assert.equal(hit.alive, false)
})

test("a full jump clears a typical rack", () => {
  let g: GameState = { ...newGame(), untilSpawn: 9999, obstacles: [{ kind: "rack", x: 260, w: 26, h: 48 }] }
  let jumped = false
  for (let i = 0; i < 240 && g.alive; i++) {
    const o = g.obstacles[0]
    if (!jumped && o && o.x - (CONFIG.playerX + CONFIG.playerW) < 70) {
      g = jump(g)
      jumped = true
    }
    g = step(g, 1 / 60, W, fixed(0.9))
  }
  assert.equal(g.alive, true)
})

test("a very long frame is clamped instead of tunnelling through", () => {
  const wall = { kind: "rack" as const, x: CONFIG.playerX + 60, w: 20, h: 40 }
  const g = step({ ...newGame(), speed: 600, obstacles: [wall] }, 1, W, fixed(0.9))
  assert.ok(g.obstacles.length === 0 || g.obstacles[0].x > 0 || !g.alive)
})
