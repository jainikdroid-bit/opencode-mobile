// RIG RUN: an endless runner for the "No connection" screen (think Chrome's offline dino).
// Pure game logic with no React/Expo imports, so it is unit-tested with plain `node --test`.
// State is immutable: every function returns a new state. Coordinates are in px; y is the
// height above the ground (0 = standing on it) and x grows to the right.

export type ObstacleKind = "rack" | "double" | "cable"

export interface Obstacle {
  kind: ObstacleKind
  x: number
  w: number
  h: number
}

export interface GameState {
  alive: boolean
  y: number
  vy: number
  speed: number
  distance: number
  /** Distance still to travel before the next obstacle appears. */
  untilSpawn: number
  obstacles: readonly Obstacle[]
}

export const CONFIG = {
  playerX: 40,
  playerW: 34,
  playerH: 44,
  gravity: 2300,
  jumpVelocity: 720,
  startSpeed: 270,
  maxSpeed: 640,
  acceleration: 9, // px/s gained per second
  hitMargin: 7, // forgiveness on every side of the player's box
} as const

export function newGame(): GameState {
  return { alive: true, y: 0, vy: 0, speed: CONFIG.startSpeed, distance: 0, untilSpawn: 260, obstacles: [] }
}

export function isOnGround(state: GameState): boolean {
  return state.y <= 0
}

/** Jump only from the ground; ignored mid-air and after game over. */
export function jump(state: GameState): GameState {
  if (!state.alive || !isOnGround(state)) return state
  return { ...state, vy: CONFIG.jumpVelocity }
}

export function score(state: GameState): number {
  return Math.floor(state.distance / 10)
}

function makeObstacle(rng: () => number, x: number): Obstacle {
  const roll = rng()
  if (roll < 0.25) return { kind: "cable", x, w: 46, h: 16 }
  if (roll < 0.55) return { kind: "double", x, w: 54, h: 40 }
  return { kind: "rack", x, w: 22 + Math.floor(rng() * 10), h: 32 + Math.floor(rng() * 20) }
}

/** Does the player's (slightly shrunk) box touch any obstacle? */
export function collides(state: GameState): boolean {
  const m = CONFIG.hitMargin
  const left = CONFIG.playerX + m
  const right = CONFIG.playerX + CONFIG.playerW - m
  const bottom = state.y + m
  return state.obstacles.some((o) => right > o.x && left < o.x + o.w && bottom < o.h)
}

/** Advance the game by `dt` seconds on a playfield `width` px wide. */
export function step(state: GameState, dt: number, width: number, rng: () => number = Math.random): GameState {
  if (!state.alive || dt <= 0) return state
  const clamped = Math.min(dt, 0.05) // a long frame must not teleport through an obstacle

  // vertical motion
  let vy = state.vy - CONFIG.gravity * clamped
  let y = state.y + vy * clamped
  if (y <= 0) {
    y = 0 // landed (or still standing): no downward speed left
    vy = 0
  }

  // world motion
  const speed = Math.min(CONFIG.maxSpeed, state.speed + CONFIG.acceleration * clamped)
  const travelled = speed * clamped
  let obstacles = state.obstacles.map((o) => ({ ...o, x: o.x - travelled })).filter((o) => o.x + o.w > -10)
  let untilSpawn = state.untilSpawn - travelled
  if (untilSpawn <= 0) {
    obstacles = [...obstacles, makeObstacle(rng, width + 20)]
    untilSpawn = speed * 0.8 + 70 + rng() * 240
  }

  const next: GameState = { alive: true, y, vy, speed, distance: state.distance + travelled, untilSpawn, obstacles }
  return collides(next) ? { ...next, alive: false } : next
}
