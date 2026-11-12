// Talks to the launcher on the computer (tools/launcher.js). The launcher only starts, stops and reports the
// opencode server; it needs the same password as the server.
import { buildRequestHeaders } from "./headers"
import { interpretStart, launcherUrl, type StartOutcome } from "./launcher"

export interface LauncherTarget {
  serverUrl: string
  launcherPort: number
  auth?: { username: string; password: string }
}

const START_TIMEOUT_MS = 45_000 // the launcher waits up to 30 s for the server to answer

export async function startServerFromPhone(target: LauncherTarget): Promise<StartOutcome> {
  const base = launcherUrl(target.serverUrl, target.launcherPort)
  if (!base) return { kind: "failed", reason: "error", detail: "bad launcher address" }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), START_TIMEOUT_MS)
  try {
    const response = await fetch(`${base}/start`, {
      method: "POST",
      headers: buildRequestHeaders({ auth: target.auth }),
      signal: controller.signal,
    })
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      /* keep null */
    }
    return interpretStart(response.status, body)
  } catch (error) {
    return { kind: "failed", reason: "unreachable", detail: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}
