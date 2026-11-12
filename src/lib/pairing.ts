// OpenCode Connect pairing links. Pure (no expo/react imports) so it is
// unit-testable with plain `node --test`.
//
// A pairing link is produced by tools/opencode-connect.ps1 on the computer
// (shown as a QR code) and consumed by the app:
//   opencode://connect?url=<server url>&password=<password>&name=<label>
// The server stays bound to 127.0.0.1 on the computer and is reached over the
// owner's private network (e.g. `tailscale serve`), so nothing is exposed to
// the public internet and no hosted relay is involved.

export interface PairingInfo {
  url: string
  password?: string
  name: string
}

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

  return buildPairing(params.url, params.password, params.name)
}

/** Validate already-split fields (deep-link route params use this directly). */
export function buildPairing(url?: string, password?: string, name?: string): PairingInfo | null {
  const serverUrl = (url ?? "").trim().replace(/\/+$/, "")
  if (!SERVER_URL.test(serverUrl)) return null
  const port = /:(\d{1,5})$/.exec(serverUrl)
  if (port && Number(port[1]) > 65535) return null

  const secret = password ?? ""
  if (secret.length > MAX_PASSWORD) return null

  const label = (name ?? "").trim().slice(0, MAX_NAME)
  const host = serverUrl.replace(/^https?:\/\//, "")
  return { url: serverUrl, password: secret || undefined, name: label || host }
}
