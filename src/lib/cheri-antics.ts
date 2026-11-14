// Cheri's little scenes ("antics"): which ones fit each mood, how long they last, when the next
// one plays, what she does when tapped, and how her face looks during each. Pure module (no React)
// so the choreography is unit-testable; CheriMascot draws it.

export type Mood = "idle" | "thinking" | "working" | "writing" | "loading" | "success" | "error" | "offline"

export type Antic =
  | "wink"
  | "yawn"
  | "earTwitch"
  | "bubblegum"
  | "coffee"
  | "lookAround"
  | "nya"
  | "sneeze"
  | "music"
  | "glitch"
  | "sleepy"
  | "sweat"
  | "celebrate"
  | "storm"
  | "giggle"
  | "hearts"
  | "pout"
  | "dizzy"

export const ANTIC_MS: Record<Antic, number> = {
  wink: 1400,
  yawn: 2200,
  earTwitch: 1000,
  bubblegum: 2600,
  coffee: 2800,
  lookAround: 2000,
  nya: 1800,
  sneeze: 1700,
  music: 2800,
  glitch: 900,
  sleepy: 3600,
  sweat: 1800,
  celebrate: 2200,
  storm: 2600,
  giggle: 1300,
  hearts: 1800,
  pout: 2000,
  dizzy: 2600,
}

/** Antics that play on their own in each mood. Loading stays still: it is short and already spins. */
const POOL: Record<Mood, readonly Antic[]> = {
  idle: ["wink", "yawn", "earTwitch", "bubblegum", "coffee", "lookAround", "nya", "sneeze", "music", "glitch"],
  thinking: ["earTwitch", "lookAround", "glitch"],
  working: ["sweat", "coffee", "earTwitch", "glitch"],
  writing: ["sweat", "earTwitch", "music"],
  loading: [],
  success: ["hearts", "wink", "music", "nya"],
  error: ["storm", "pout", "sweat"],
  offline: ["sleepy", "yawn", "sneeze", "lookAround"],
}

export function anticPool(mood: Mood): readonly Antic[] {
  return POOL[mood]
}

/** Pick a random antic for the mood, avoiding an immediate repeat when there is a choice. */
export function pickAntic(mood: Mood, rand: () => number, last?: Antic | null): Antic | null {
  const pool = POOL[mood]
  if (pool.length === 0) return null
  const choices = pool.length > 1 && last ? pool.filter((a) => a !== last) : pool
  const index = Math.min(choices.length - 1, Math.floor(rand() * choices.length))
  return choices[index]
}

const DELAY: Record<Mood, readonly [number, number] | null> = {
  idle: [5000, 11000],
  thinking: [7000, 13000],
  working: [8000, 15000],
  writing: [8000, 15000],
  loading: null,
  success: [4000, 8000],
  error: [5000, 9000],
  offline: [4000, 8000],
}

/** Pause before the next spontaneous antic, or null when the mood has none. */
export function nextDelayMs(mood: Mood, rand: () => number): number | null {
  const range = DELAY[mood]
  if (!range) return null
  const [min, max] = range
  return Math.round(min + rand() * (max - min))
}

/** A scene played the moment the mood changes: a party on success, a little rain cloud on error. */
export function enterAntic(previous: Mood, next: Mood): Antic | null {
  if (previous === next) return null
  if (next === "success") return "celebrate"
  if (next === "error") return "storm"
  return null
}

/** Taps closer together than this count as one burst. */
export const TAP_WINDOW_MS = 1800

/** The more you poke her, the less amused she is. */
export function tapAntic(tapsInBurst: number): Antic {
  if (tapsInBurst >= 7) return "dizzy"
  if (tapsInBurst >= 4) return "pout"
  if (tapsInBurst >= 2) return "hearts"
  return "giggle"
}

export type EyeKind = "open" | "happy" | "wink" | "closed" | "squeeze" | "spiral" | "narrow" | "look" | "sleepy"
export type MouthKind = "smile" | "open" | "yawn" | "cat" | "o" | "pout" | "wavy" | "frown" | "flat" | "side"

export interface Face {
  eyes: EyeKind
  mouth: MouthKind
  blush: "normal" | "strong" | "faint"
}

const ANTIC_FACE: Record<Antic, Face> = {
  wink: { eyes: "wink", mouth: "open", blush: "normal" },
  yawn: { eyes: "closed", mouth: "yawn", blush: "normal" },
  earTwitch: { eyes: "open", mouth: "smile", blush: "normal" },
  bubblegum: { eyes: "open", mouth: "o", blush: "normal" },
  coffee: { eyes: "happy", mouth: "smile", blush: "strong" },
  lookAround: { eyes: "look", mouth: "side", blush: "normal" },
  nya: { eyes: "happy", mouth: "cat", blush: "strong" },
  sneeze: { eyes: "squeeze", mouth: "o", blush: "strong" },
  music: { eyes: "happy", mouth: "open", blush: "normal" },
  glitch: { eyes: "open", mouth: "flat", blush: "faint" },
  sleepy: { eyes: "sleepy", mouth: "o", blush: "normal" },
  sweat: { eyes: "open", mouth: "wavy", blush: "faint" },
  celebrate: { eyes: "wink", mouth: "open", blush: "strong" },
  storm: { eyes: "open", mouth: "frown", blush: "faint" },
  giggle: { eyes: "happy", mouth: "open", blush: "strong" },
  hearts: { eyes: "happy", mouth: "smile", blush: "strong" },
  pout: { eyes: "narrow", mouth: "pout", blush: "strong" },
  dizzy: { eyes: "spiral", mouth: "wavy", blush: "normal" },
}

const MOOD_FACE: Record<Mood, Face> = {
  idle: { eyes: "open", mouth: "smile", blush: "normal" },
  thinking: { eyes: "open", mouth: "side", blush: "normal" },
  working: { eyes: "open", mouth: "smile", blush: "normal" },
  writing: { eyes: "open", mouth: "smile", blush: "normal" },
  loading: { eyes: "open", mouth: "smile", blush: "normal" },
  success: { eyes: "happy", mouth: "open", blush: "normal" },
  error: { eyes: "open", mouth: "o", blush: "faint" },
  offline: { eyes: "sleepy", mouth: "flat", blush: "normal" },
}

/** The face to draw: the running antic wins over the mood. */
export function faceFor(mood: Mood, antic: Antic | null): Face {
  return antic ? ANTIC_FACE[antic] : MOOD_FACE[mood]
}
