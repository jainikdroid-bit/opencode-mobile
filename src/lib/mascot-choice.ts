// Which character the app shows in empty states, the status line and the runner game.
// Pure module (no React) so the stored value can be validated in unit tests.

export const MASCOT_KINDS = ["cheri", "rig"] as const
export type MascotKind = (typeof MASCOT_KINDS)[number]

/** Cheri, the cat-eared girl, is the default since 0.16; RIG stays available in Settings. */
export const DEFAULT_MASCOT: MascotKind = "cheri"

export function isMascotKind(value: unknown): value is MascotKind {
  return typeof value === "string" && (MASCOT_KINDS as readonly string[]).includes(value)
}

/** Settings stored by an older or newer build may hold an unknown value: fall back to the default. */
export function resolveMascot(value: unknown): MascotKind {
  return isMascotKind(value) ? value : DEFAULT_MASCOT
}
