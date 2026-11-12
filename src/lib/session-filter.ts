// Search and pinning for the sessions list. Pure functions so they are easy to test.
import type { Session } from "./sdk"

export const PINNED_KEY = "oc_pinned_sessions"

/** Sessions whose title, folder or id contain every word of the query (case-insensitive). Empty query keeps all. */
export function filterSessions<T extends Pick<Session, "id" | "title" | "directory">>(sessions: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return sessions
  return sessions.filter((s) => {
    const hay = `${s.title ?? ""} ${s.directory ?? ""} ${s.id}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Splits into pinned (in pin order, newest pin first) and the rest (original order). */
export function splitPinned<T extends { id: string }>(sessions: T[], pinned: readonly string[]): { pinned: T[]; rest: T[] } {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const pinnedItems = pinned.map((id) => byId.get(id)).filter((s): s is T => !!s)
  const set = new Set(pinnedItems.map((s) => s.id))
  return { pinned: pinnedItems, rest: sessions.filter((s) => !set.has(s.id)) }
}

/** Adds or removes an id; new pins go first. Never mutates the input. */
export function togglePin(pinned: readonly string[], id: string): string[] {
  return pinned.includes(id) ? pinned.filter((p) => p !== id) : [id, ...pinned]
}

/** Tolerant parse of the stored value. */
export function parsePinned(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "[]")
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}
