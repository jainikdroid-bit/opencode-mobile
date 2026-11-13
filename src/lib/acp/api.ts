// Network side of "other agents": the computer's launcher (tools/acp-bridge.js) starts them and relays their
// Agent Client Protocol messages. Same password and same ways of reaching the computer as everything else
// (home network directly, Tailscale when away), because requests go through routeUrl.
import { fetch as expoFetch } from "expo/fetch"
import { buildRequestHeaders } from "../headers"
import { launcherUrl } from "../launcher"
import { routeUrl } from "../tailnet"
import { AcpFrameParser } from "./frames"
import type { RpcMessage, StreamEvent } from "./protocol"

export interface AcpTarget {
  serverUrl: string
  launcherPort: number
  auth?: { username: string; password: string }
  /** tunnel mode: the launcher lives under /__oc/launcher on the one public address */
  tunnel?: boolean
}

export interface AgentInfo {
  id: string
  name: string
  installed: boolean
}

export interface RunningAgent {
  id: string
  agent: string
  name: string
  cwd: string
  startedAt: number
  exited: boolean
}

/** `status` 0 means the computer did not answer. */
export class AcpApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
  /** The launcher on the computer predates other agents: the setup command has to run there again. */
  get outdated(): boolean {
    return this.status === 404 && /not found/i.test(this.message)
  }
}

const CALL_TIMEOUT_MS = 20_000
const START_TIMEOUT_MS = 30_000
const STREAM_IDLE_MS = 45_000 // the bridge sends a heartbeat every 15 s

async function call<T>(target: AcpTarget, path: string, init: RequestInit = {}, timeoutMs = CALL_TIMEOUT_MS): Promise<T> {
  const base = launcherUrl(target.serverUrl, target.launcherPort, target.tunnel)
  if (!base) throw new AcpApiError(0, "bad launcher address")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(await routeUrl(`${base}${path}`), { ...init, headers: buildRequestHeaders({ auth: target.auth }), signal: controller.signal })
    const text = await response.text()
    let body: any = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      /* not JSON */
    }
    if (!response.ok) throw new AcpApiError(response.status, typeof body?.error === "string" ? body.error : `HTTP ${response.status}`)
    return body as T
  } catch (error) {
    if (error instanceof AcpApiError) throw error
    throw new AcpApiError(0, error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timer)
  }
}

export async function listAgents(target: AcpTarget): Promise<{ agents: AgentInfo[]; running: RunningAgent[] }> {
  const body = await call<{ agents?: AgentInfo[]; running?: RunningAgent[] }>(target, "/acp/agents")
  return { agents: body.agents ?? [], running: body.running ?? [] }
}

export async function startAgent(target: AcpTarget, agent: string, cwd?: string): Promise<{ id: string; name: string; cwd: string }> {
  return call(target, "/acp/start", { method: "POST", body: JSON.stringify({ agent, ...(cwd ? { cwd } : {}) }) }, START_TIMEOUT_MS)
}

export async function sendMessage(target: AcpTarget, id: string, message: RpcMessage): Promise<void> {
  await call(target, `/acp/${encodeURIComponent(id)}/send`, { method: "POST", body: JSON.stringify(message) })
}

export async function stopAgent(target: AcpTarget, id: string): Promise<void> {
  await call(target, `/acp/${encodeURIComponent(id)}/stop`, { method: "POST" })
}

/** Read the agent's event stream from sequence number `from` on. Ends when the connection does; throws when it cannot open. */
export async function* streamEvents(target: AcpTarget, id: string, from: number, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  const base = launcherUrl(target.serverUrl, target.launcherPort, target.tunnel)
  if (!base) throw new AcpApiError(0, "bad launcher address")
  const headers = buildRequestHeaders({ auth: target.auth })
  delete headers["Content-Type"]
  let response
  try {
    // expo/fetch gives a ReadableStream body on native.
    response = await expoFetch(await routeUrl(`${base}/acp/${encodeURIComponent(id)}/events?from=${from}`), { headers, signal })
  } catch (error) {
    throw new AcpApiError(0, error instanceof Error ? error.message : String(error))
  }
  if (!response.ok || !response.body) throw new AcpApiError(response.status, `HTTP ${response.status}`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const parser = new AcpFrameParser()
  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const chunk = await Promise.race([
        reader.read(),
        new Promise<"idle">((resolve) => {
          timer = setTimeout(() => resolve("idle"), STREAM_IDLE_MS)
        }),
      ]).finally(() => clearTimeout(timer))
      if (chunk === "idle") {
        void reader.cancel().catch(() => undefined)
        throw new AcpApiError(0, "no heartbeat: the connection went quiet")
      }
      if (chunk.done) return
      for (const event of parser.push(decoder.decode(chunk.value, { stream: true }))) yield event
    }
  } finally {
    reader.releaseLock()
  }
}
