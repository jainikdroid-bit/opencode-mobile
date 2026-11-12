// Phone tools for the AI agent: what exists, what needs asking, and how requests are checked. Pure (no React/Expo).
// The phone is the gatekeeper: everything is off until the user switches it on, and sensitive tools ask every time.

export type PhoneToolName =
  | "phone_info"
  | "phone_clipboard_read"
  | "phone_clipboard_write"
  | "phone_notify"
  | "phone_speak"
  | "phone_location"
  | "phone_photo"

export interface PhoneToolMeta {
  name: PhoneToolName
  icon: string
  /** true: the user must confirm every single call, even when the tool is switched on */
  confirmEachTime: boolean
}

export const PHONE_TOOLS: PhoneToolMeta[] = [
  { name: "phone_info", icon: "phone-portrait-outline", confirmEachTime: false },
  { name: "phone_notify", icon: "notifications-outline", confirmEachTime: false },
  { name: "phone_speak", icon: "volume-high-outline", confirmEachTime: false },
  { name: "phone_clipboard_write", icon: "clipboard-outline", confirmEachTime: true },
  { name: "phone_clipboard_read", icon: "copy-outline", confirmEachTime: true },
  { name: "phone_location", icon: "location-outline", confirmEachTime: true },
  { name: "phone_photo", icon: "camera-outline", confirmEachTime: true },
]

export interface PhoneToolSettings {
  /** master switch; off by default */
  enabled: boolean
  /** per-tool switches; missing = off */
  allowed: Partial<Record<PhoneToolName, boolean>>
}

export const DEFAULT_PHONE_SETTINGS: PhoneToolSettings = { enabled: false, allowed: {} }

export type Decision = "deny" | "ask" | "allow"

export function decide(settings: PhoneToolSettings, tool: string): Decision {
  const meta = PHONE_TOOLS.find((t) => t.name === tool)
  if (!meta || !settings.enabled || !settings.allowed[meta.name]) return "deny"
  return meta.confirmEachTime ? "ask" : "allow"
}

export const MAX_TEXT = 4000

/** Validates and trims the arguments an agent sent; returns an error message instead of throwing. */
export function checkArgs(tool: PhoneToolName, args: unknown): { ok: true; args: Record<string, string> } | { ok: false; error: string } {
  const a = (args && typeof args === "object" ? args : {}) as Record<string, unknown>
  const str = (key: string, required: boolean): string | null => {
    const v = a[key]
    if (v === undefined || v === null || v === "") return required ? `missing "${key}"` : ""
    if (typeof v !== "string") return `"${key}" must be text`
    return null
  }
  const fields: Record<PhoneToolName, Array<[string, boolean]>> = {
    phone_info: [],
    phone_clipboard_read: [],
    phone_clipboard_write: [["text", true]],
    phone_notify: [["title", false], ["body", true]],
    phone_speak: [["text", true]],
    phone_location: [],
    phone_photo: [],
  }
  const out: Record<string, string> = {}
  for (const [key, required] of fields[tool]) {
    const problem = str(key, required)
    if (problem) return { ok: false, error: problem }
    out[key] = String(a[key] ?? "").slice(0, MAX_TEXT)
  }
  return { ok: true, args: out }
}

/** Same host as the server, bridge port = launcher port - 1 (see tools/connect.js). */
export function bridgeUrl(serverUrl: string, launcherPort: number | undefined): string | null {
  if (!Number.isInteger(launcherPort) || (launcherPort as number) < 2) return null
  const m = /^(https?:\/\/)(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+)(?::\d{1,5})?\/?$/.exec(serverUrl.trim())
  return m ? `${m[1]}${m[2]}:${(launcherPort as number) - 1}` : null
}

export interface AuditEntry {
  time: number
  tool: string
  outcome: "done" | "declined" | "off" | "error"
}

/** Newest first, capped. */
export function pushAudit(log: readonly AuditEntry[], entry: AuditEntry, cap = 50): AuditEntry[] {
  return [entry, ...log].slice(0, cap)
}

export function parsePhoneSettings(raw: string | null | undefined): PhoneToolSettings {
  try {
    const v = JSON.parse(raw ?? "null")
    if (!v || typeof v !== "object") return DEFAULT_PHONE_SETTINGS
    const allowed: PhoneToolSettings["allowed"] = {}
    for (const t of PHONE_TOOLS) if (v.allowed && v.allowed[t.name] === true) allowed[t.name] = true
    return { enabled: v.enabled === true, allowed }
  } catch {
    return DEFAULT_PHONE_SETTINGS
  }
}
