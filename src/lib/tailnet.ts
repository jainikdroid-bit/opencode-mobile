// Built-in Tailscale: the app carries its own tailnet node (native module "Tailnet"), so it reaches a
// computer on a 100.x / *.ts.net address without the Tailscale app and without the Android VPN slot.
// Requests to such addresses are sent to a local forward 127.0.0.1:<port> that the node carries over.
import { NativeModules, Platform } from "react-native"
import { tailnetTarget } from "./tailnet-host"

export interface TailnetStatus {
  ready: boolean
  authUrl: string
  ip: string
  error: string
}

interface TailnetNative {
  isAvailable(): Promise<boolean>
  start(hostname: string): Promise<void>
  status(): Promise<TailnetStatus>
  forward(target: string): Promise<number>
  refreshNetwork(): Promise<void>
  logout(): Promise<void>
  stop(): Promise<void>
  logTail(lines: number): Promise<string>
  peers(): Promise<string>
  localAddresses(): Promise<string[]>
}

const native: TailnetNative | undefined =
  Platform.OS === "android" ? (NativeModules.Tailnet as TailnetNative | undefined) : undefined

const NODE_NAME = "opencode-phone"
const READY_WAIT_MS = 15_000
const POLL_MS = 500

let enabled = false
let started = false
const forwards = new Map<string, number>()

export async function tailnetAvailable(): Promise<boolean> {
  if (!native) return false
  try {
    return await native.isAvailable()
  } catch {
    return false
  }
}

export function tailnetEnabled(): boolean {
  return enabled
}

async function ensureStarted(): Promise<void> {
  if (!native || started) return
  started = true
  try {
    await native.start(NODE_NAME)
  } catch (error) {
    started = false
    throw error
  }
}

/** Turn the built-in node on or off. Turning it on starts it; a needed sign-in shows up in tailnetStatus().authUrl. */
export async function setTailnetEnabled(on: boolean): Promise<void> {
  enabled = on && !!native
  if (!native) return
  if (enabled) {
    await ensureStarted()
    return
  }
  forwards.clear()
  if (started) {
    started = false
    await native.stop().catch(() => undefined)
  }
}

export async function tailnetStatus(): Promise<TailnetStatus | null> {
  if (!native || !enabled) return null
  try {
    return await native.status()
  } catch {
    return null
  }
}

export async function tailnetLogout(): Promise<void> {
  if (!native) return
  forwards.clear()
  await native.logout().catch(() => undefined)
}

export async function tailnetLog(lines = 40): Promise<string> {
  if (!native) return ""
  return native.logTail(lines).catch(() => "")
}

export interface TailnetPeer {
  name: string
  ip: string
}

/** Online devices of the tailnet; empty unless the built-in node is on and connected. */
export async function tailnetPeers(): Promise<TailnetPeer[]> {
  if (!native || !enabled || !started) return []
  try {
    const list: unknown = JSON.parse(await native.peers())
    if (!Array.isArray(list)) return []
    return list.filter((p): p is TailnetPeer => !!p && typeof p.ip === "string" && typeof p.name === "string")
  } catch {
    return []
  }
}

/** IPv4 addresses of this phone as "ip/prefix" (Android only; empty elsewhere). */
export async function localAddresses(): Promise<string[]> {
  if (!native) return []
  return native.localAddresses().catch(() => [])
}

/** Tell the node the phone changed network (Wi-Fi <-> mobile), so it re-reads the interfaces. */
export function tailnetNetworkChanged(): void {
  if (native && enabled && started) void native.refreshNetwork().catch(() => undefined)
}

async function waitReady(): Promise<boolean> {
  if (!native) return false
  const until = Date.now() + READY_WAIT_MS
  for (;;) {
    const status = await native.status().catch(() => null)
    if (status?.ready) return true
    // Waiting for the user to sign in: no point holding the request.
    if (status?.authUrl) return false
    if (Date.now() >= until) return false
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

/**
 * Address to actually request. Unchanged unless the built-in node is on and the URL points into a tailnet;
 * then it is the local end of a forward. Falls back to the original URL when the node is not ready,
 * so the Tailscale app (if the user runs that instead) keeps working.
 */
export async function routeUrl(url: string): Promise<string> {
  if (!enabled || !native) return url
  const route = tailnetTarget(url)
  if (!route) return url
  const known = forwards.get(route.target)
  if (known) return route.rewrite(known)
  try {
    await ensureStarted()
    if (!(await waitReady())) return url
    const port = await native.forward(route.target)
    forwards.set(route.target, port)
    return route.rewrite(port)
  } catch {
    return url
  }
}
