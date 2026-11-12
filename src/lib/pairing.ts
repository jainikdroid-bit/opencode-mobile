// OpenCode Connect pairing links. Pure (no expo/react imports) so it is
// unit-testable with plain `node --test`.
//
// A pairing link is produced by tools/opencode-connect.ps1 on the computer
// (shown as a QR code) and consumed by the app:
//   opencode://connect?url=<server url>&password=<password>&name=<label>[&launcher=<port>]
// The server stays bound to 127.0.0.1 on the computer and is reached over the
// owner's private network (e.g. `tailscale serve`), so nothing is exposed to
// the public internet and no hosted relay is involved.

export interface PairingInfo {
  url: string
  password?: string
  name: string
  /** Port of the launcher that can start the server from the phone (optional). */
  launcherPort?: number
  /** Private ntfy.sh topic on which the computer announces its tunnel address (tunnel mode). */
  tunnelTopic?: string
}

// ntfy.sh topic on which a tunnel-mode computer announces its address (same rule as tunnel-discovery.ts)
const isValidTopic = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(t)
const MAX_NAME = 40
const MAX_PASSWORD = 256
// scheme://host[:port] only — a pairing link must not smuggle paths or creds.
const SERVER_URL = /^https?:\/\/(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+)(:\d{1,5})?$/

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "))
  } catch {
    return null
  }
}

/** Parse a pairing link; returns null for anything that is not a valid one. */
export function parsePairingLink(input: string): PairingInfo | null {
  const text = input.trim()
  const match = /^opencode:\/\/connect\/?\?(.*)$/i.exec(text)
  if (!match) return null

  const params: Record<string, string> = {}
  for (const pair of match[1].split("&")) {
    if (!pair) continue
    const eq = pair.indexOf("=")
    const key = decode(eq === -1 ? pair : pair.slice(0, eq))
    const value = decode(eq === -1 ? "" : pair.slice(eq + 1))
    if (key === null || value === null) return null
    params[key] = value
  }

  return buildPairing(params.url, params.password, params.name, params.launcher, params.topic)
}

/** Validate already-split fields (deep-link route params use this directly). */
export function buildPairing(url?: string, password?: string, name?: string, launcher?: string | number, topic?: string): PairingInfo | null {
  const serverUrl = (url ?? "").trim().replace(/\/+$/, "")
  if (!SERVER_URL.test(serverUrl)) return null
  const port = /:(\d{1,5})$/.exec(serverUrl)
  if (port && Number(port[1]) > 65535) return null

  const secret = password ?? ""
  if (secret.length > MAX_PASSWORD) return null

  const label = (name ?? "").trim().slice(0, MAX_NAME)
  const host = serverUrl.replace(/^https?:\/\//, "")
  const launcherPort = parseLauncherPort(launcher)
  const tunnelTopic = isValidTopic(topic) ? topic : undefined
  return { url: serverUrl, password: secret || undefined, name: label || host, ...(launcherPort ? { launcherPort } : {}), ...(tunnelTopic ? { tunnelTopic } : {}) }
}

/** A launcher port is optional; anything that is not a valid TCP port is simply ignored. */
export function parseLauncherPort(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined
  const n = typeof value === "number" ? value : /^\d{1,5}$/.test(value) ? Number(value) : NaN
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : undefined
}
