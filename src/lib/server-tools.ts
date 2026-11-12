// Pure helpers for the Files and Terminal screens (no React/Expo imports, so they run
// under plain `node --test`; test files import them with .ts extensions).

export interface FileEntryLike {
  name: string
  path: string
  type: "file" | "directory"
  ignored?: boolean
}

/** Directories first, then files, each group alphabetically (case-insensitive). Hidden/ignored last in group. */
export function sortEntries<T extends FileEntryLike>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1
    if (!!a.ignored !== !!b.ignored) return a.ignored ? 1 : -1
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

/** Parent of a relative path: "a/b/c" -> "a/b", "a" -> "", "" -> "". Accepts / or \ separators. */
export function parentPath(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean)
  return parts.slice(0, -1).join("/")
}

/** Breadcrumb segments with the relative path each one opens. "" is the root. */
export function breadcrumbs(path: string): Array<{ label: string; path: string }> {
  const parts = path.split(/[\\/]+/).filter(Boolean)
  return parts.map((label, i) => ({ label, path: parts.slice(0, i + 1).join("/") }))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ""
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const MAX_VIEW_CHARS = 200_000

/** Text longer than the cap is cut at a line boundary and flagged so the UI can say so. */
export function clipForView(text: string, max = MAX_VIEW_CHARS): { text: string; clipped: boolean } {
  if (text.length <= max) return { text, clipped: false }
  const cut = text.slice(0, max)
  const lastBreak = cut.lastIndexOf("\n")
  return { text: lastBreak > max * 0.5 ? cut.slice(0, lastBreak) : cut, clipped: true }
}

/** Number lines for display; returns the gutter width too. */
export function numberLines(text: string): { lines: string[]; gutter: number } {
  const lines = text.split("\n")
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()
  return { lines, gutter: String(lines.length).length }
}

/** http(s)://host:port -> ws(s)://host:port (trailing slash removed). */
export function toWebSocketBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/^http/i, "ws")
}

export function ptySocketUrl(baseUrl: string, ptyID: string): string {
  return `${toWebSocketBase(baseUrl)}/pty/${encodeURIComponent(ptyID)}/connect`
}

/** The server's first PTY frame is a control frame ("\u0000" + JSON, e.g. the replay cursor). */
export function isControlFrame(frame: string): boolean {
  return frame.length > 0 && frame.charCodeAt(0) === 0
}

/** Bytes a phone keyboard cannot type, by label. Ctrl letters are 1..26. */
export const SPECIAL_KEYS: Record<string, string> = {
  esc: "\u001b",
  tab: "\t",
  up: "\u001b[A",
  down: "\u001b[B",
  right: "\u001b[C",
  left: "\u001b[D",
  home: "\u001b[H",
  end: "\u001b[F",
  pgup: "\u001b[5~",
  pgdn: "\u001b[6~",
  enter: "\r",
}

/** Apply a sticky Ctrl to the next typed character: Ctrl+C -> 0x03. Non-letters pass through. */
export function applyCtrl(input: string): string {
  if (input.length !== 1) return input
  const c = input.toUpperCase().charCodeAt(0)
  if (c >= 65 && c <= 90) return String.fromCharCode(c - 64)
  if (input === "[") return "\u001b"
  if (input === " ") return "\u0000"
  return input
}

/**
 * What to send to the shell when a text field changes from `prev` to `next`: backspaces for
 * what was removed after the common prefix, then the new characters. Lets an ordinary text
 * field (with any keyboard or IME) drive a live shell line.
 */
export function diffInput(prev: string, next: string): string {
  let common = 0
  const limit = Math.min(prev.length, next.length)
  while (common < limit && prev[common] === next[common]) common++
  return "\u007f".repeat(prev.length - common) + next.slice(common)
}
