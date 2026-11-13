// Home network first: a computer paired over Tailscale also listens on its home-network address (the launcher
// mirrors the ports there, see tools/launcher.js). When the phone is on that network, requests go there directly,
// with no Tailscale and no VPN needed; anywhere else they keep going over Tailscale.
//
// Before anything is sent to the home-network address, the computer must prove it is the one paired with:
// another network may have a different device on the same address, and every request carries the password.
// The proof is sha256("<phone nonce>:<password>") from the launcher's GET /hello (no secrets travel).
// Pure (no React Native imports): the side effects are injected, so this runs under `node --test`.

export interface LanRoute {
  /** Host of the saved server address (usually the computer's Tailscale address). */
  remoteHost: string
  /** The same computer on the home network. */
  lanHost: string
  /** Launcher port on that computer: it answers the identity check. */
  launcherPort: number
  password: string
}

export interface LanRouterDeps {
  /** GET a URL; null when nothing answers in time. */
  fetchJson(url: string, timeoutMs: number): Promise<{ status: number; body: unknown } | null>
  sha256Hex(text: string): Promise<string>
  nonce(): string
  now(): number
}

const PROBE_TIMEOUT_MS = 1_200
// A confirmed home network is re-checked after this long (the phone may have left it); a miss sooner.
const REACHABLE_TTL_MS = 30_000
const UNREACHABLE_TTL_MS = 60_000

const PRIVATE_V4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

/** A private IPv4 address (10/8, 172.16/12, 192.168/16) in plain dotted form. */
export function isPrivateV4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m || m.slice(1).some((part) => Number(part) > 255)) return false
  return PRIVATE_V4.test(host)
}

/** The home-network form of a URL, when one of the routes covers its host (plain http only). */
export function lanRouteFor(url: string, routes: LanRoute[]): { route: LanRoute; url: string } | null {
  const m = /^http:\/\/([^/:?#\s]+)(:\d+)?(.*)$/i.exec(url)
  if (!m) return null
  const host = m[1].toLowerCase()
  const route = routes.find((r) => r.remoteHost.toLowerCase() === host && r.lanHost.toLowerCase() !== host)
  return route ? { route, url: `http://${route.lanHost}${m[2] ?? ""}${m[3]}` } : null
}

const validRoute = (r: LanRoute) =>
  !!r && isPrivateV4(r.lanHost) && !!r.remoteHost && !!r.password && Number.isInteger(r.launcherPort) && r.launcherPort > 0 && r.launcherPort < 65536

export function createLanRouter(deps: LanRouterDeps) {
  let routes: LanRoute[] = []
  let routesKey = ""
  const known = new Map<string, { ok: boolean; at: number }>()
  const pending = new Map<string, Promise<boolean>>()

  async function verify(route: LanRoute): Promise<boolean> {
    const nonce = deps.nonce()
    const reply = await deps.fetchJson(`http://${route.lanHost}:${route.launcherPort}/hello?n=${nonce}`, PROBE_TIMEOUT_MS)
    if (!reply || reply.status !== 200 || !reply.body || typeof reply.body !== "object") return false
    const proof = (reply.body as { proof?: unknown }).proof
    return typeof proof === "string" && proof === (await deps.sha256Hex(`${nonce}:${route.password}`))
  }

  function reachable(route: LanRoute): Promise<boolean> {
    const key = `${route.lanHost}:${route.launcherPort}`
    const seen = known.get(key)
    if (seen && deps.now() - seen.at < (seen.ok ? REACHABLE_TTL_MS : UNREACHABLE_TTL_MS)) return Promise.resolve(seen.ok)
    const running = pending.get(key)
    if (running) return running
    const check = verify(route)
      .catch(() => false)
      .then((ok) => {
        known.set(key, { ok, at: deps.now() })
        pending.delete(key)
        return ok
      })
    pending.set(key, check)
    return check
  }

  return {
    /** Replace the routes (the active connection's). Forgets earlier checks when they change. */
    setRoutes(list: LanRoute[]) {
      const next = list.filter(validRoute)
      const key = JSON.stringify(next.map((r) => [r.remoteHost, r.lanHost, r.launcherPort, r.password.length]))
      if (key !== routesKey) known.clear()
      routes = next
      routesKey = key
    },
    /** The phone changed network (or came back to the front): check again before the next request. */
    networkChanged() {
      known.clear()
    },
    /** The URL to use on the home network, or null to keep the usual one. */
    async rewrite(url: string): Promise<string | null> {
      const match = lanRouteFor(url, routes)
      if (!match) return null
      return (await reachable(match.route)) ? match.url : null
    },
  }
}
