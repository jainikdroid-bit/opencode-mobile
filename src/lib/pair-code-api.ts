// Network side of pairing with a short code: find computers that have a code waiting, and trade the code
// for the connection details. See pair-code.ts for the rules and tools/launcher.js for the other end.
import { DEFAULT_LAUNCHER_PORT, interpretPairReply, lanCandidates, offerName, type PairOutcome, type PairTarget } from "./pair-code"
import { localAddresses, routeUrl, tailnetPeers } from "./tailnet"

export interface FoundComputer extends PairTarget {
  name: string
}

const PROBE_TIMEOUT_MS = 1_500
const TAILNET_PROBE_TIMEOUT_MS = 4_000
const EXCHANGE_TIMEOUT_MS = 10_000
const PARALLEL_PROBES = 32
const MAX_TAILNET_PEERS = 24

async function call(target: PairTarget, init: RequestInit, timeoutMs: number): Promise<{ status: number; body: unknown } | null> {
  // Routing first: for a tailnet address it may wait for the built-in node, which must not eat the timeout.
  const url = await routeUrl(`http://${target.host}:${target.port}/pair`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      /* not ours */
    }
    return { status: response.status, body }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Is a pairing code waiting on this address? Resolves the computer (with its name) or null. */
export async function probe(target: PairTarget, timeoutMs = PROBE_TIMEOUT_MS): Promise<FoundComputer | null> {
  const reply = await call(target, { method: "GET" }, timeoutMs)
  const name = reply ? offerName(reply.status, reply.body) : null
  return name === null ? null : { ...target, name: name || target.host }
}

/** Send the code to the computer. A computer that does not answer at all is "failed" with detail "unreachable". */
export async function exchangeCode(target: PairTarget, code: string): Promise<PairOutcome> {
  const reply = await call(target, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }, EXCHANGE_TIMEOUT_MS)
  if (!reply) return { kind: "failed", detail: "unreachable" }
  return interpretPairReply(target, reply.status, reply.body)
}

/**
 * Look for computers with a waiting code: devices of the tailnet (built-in Tailscale, when connected) and
 * the phone's own home network. Each one is reported as soon as it answers. Only the usual launcher port
 * is tried; a computer set up on another port is paired by typing its address.
 */
export async function findComputers(onFound: (computer: FoundComputer) => void, cancelled: () => boolean): Promise<void> {
  const peers = (await tailnetPeers()).slice(0, MAX_TAILNET_PEERS)
  const fromTailnet = Promise.all(
    peers.map(async (peer) => {
      const found = await probe({ host: peer.ip, port: DEFAULT_LAUNCHER_PORT }, TAILNET_PROBE_TIMEOUT_MS)
      if (found && !cancelled()) onFound({ ...found, name: found.name === found.host ? peer.name : found.name })
    }),
  )

  const queue = lanCandidates(await localAddresses())
  const worker = async () => {
    for (;;) {
      const host = queue.shift()
      if (!host || cancelled()) return
      const found = await probe({ host, port: DEFAULT_LAUNCHER_PORT })
      if (found && !cancelled()) onFound(found)
    }
  }
  await Promise.all([fromTailnet, ...Array.from({ length: PARALLEL_PROBES }, worker)])
}
