// Pairing with a short code, for when the QR code cannot be scanned. The installer on the computer shows
// six digits; the launcher there (tools/launcher.js, route /pair) trades the right code for the connection
// details. Pure helpers only (no React Native imports: runs under `node --test`).

export const DEFAULT_LAUNCHER_PORT = 4095
export const CODE_LENGTH = 6
const SUBNET_HOSTS = 254
const MAX_SUBNETS = 2

export interface PairTarget {
  host: string
  port: number
}

/** Keep the digits of whatever was typed ("482 913" -> "482913"), at most six. */
export function normalizeCode(text: string): string {
  return text.replace(/\D/g, "").slice(0, CODE_LENGTH)
}

export const isCompleteCode = (code: string): boolean => code.length === CODE_LENGTH

/** "482913" -> "482 913", for showing while it is typed. */
export function formatCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}

/** What the person typed as the computer's address: a host, optionally with the launcher port. */
export function parsePairAddress(text: string): PairTarget | null {
  const cleaned = text.trim().replace(/^https?:\/\//i, "").replace(/[/?#].*$/, "")
  const m = /^([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/.exec(cleaned)
  if (!m || !/[A-Za-z0-9]/.test(m[1])) return null
  const port = m[2] ? Number(m[2]) : DEFAULT_LAUNCHER_PORT
  if (port < 1 || port > 65535) return null
  return { host: m[1].toLowerCase(), port }
}

const PRIVATE_V4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

/**
 * Addresses worth asking on the home network: the other 253 hosts of the /24 around each private IPv4
 * address of the phone ("192.168.1.34/24" as the system reports it). VPN and tailnet ranges are skipped.
 */
export function lanCandidates(addresses: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of addresses) {
    const ip = entry.split("/")[0].trim()
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
    if (!m || !PRIVATE_V4.test(ip)) continue
    const subnet = `${m[1]}.${m[2]}.${m[3]}`
    if (seen.has(subnet)) continue
    if (seen.size >= MAX_SUBNETS) break
    seen.add(subnet)
    for (let last = 1; last <= SUBNET_HOSTS; last++) if (last !== Number(m[4])) out.push(`${subnet}.${last}`)
  }
  return out
}

/** The name a launcher gives while a code is waiting on it; null for any other answer. */
export function offerName(status: number, body: unknown): string | null {
  if (status !== 200 || !body || typeof body !== "object") return null
  const reply = body as { ok?: unknown; pairing?: unknown; name?: unknown }
  if (reply.ok !== true || reply.pairing !== true) return null
  return typeof reply.name === "string" ? reply.name : ""
}

export type PairOutcome =
  | { kind: "ok"; url: string; password: string; name: string; launcherPort: number }
  /** wrong code; `left` more tries before the computer throws the code away (0 = it just did) */
  | { kind: "wrong"; left: number }
  /** no code is waiting on that computer (never made, expired, used, or burned) */
  | { kind: "inactive" }
  | { kind: "failed"; detail: string }

/** Turn the launcher's answer to POST /pair into what the screen should do. */
export function interpretPairReply(target: PairTarget, status: number, body: unknown): PairOutcome {
  const reply = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  if (status === 403) return { kind: "wrong", left: Number.isInteger(reply.left) ? Math.max(0, reply.left as number) : 0 }
  if (status === 404) return { kind: "inactive" }
  // An older launcher has no /pair: it asks for the password instead.
  if (status === 401) return { kind: "inactive" }
  if (status !== 200 || reply.ok !== true) return { kind: "failed", detail: `HTTP ${status}` }
  const port = Number(reply.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535 || typeof reply.password !== "string" || !reply.password) {
    return { kind: "failed", detail: "unexpected answer" }
  }
  const launcherPort = Number.isInteger(reply.launcherPort) ? (reply.launcherPort as number) : target.port
  return { kind: "ok", url: `http://${target.host}:${port}`, password: reply.password, name: typeof reply.name === "string" ? reply.name : "", launcherPort }
}
