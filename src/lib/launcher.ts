// Start the opencode server on the computer from the phone, through the tiny launcher that
// tools/opencode-connect.* keeps running there (see tools/launcher.js). Pure helpers, no React/Expo imports.

/** http://100.1.2.3:4096 + 4095 -> http://100.1.2.3:4095 (same host, launcher port). */
export function launcherUrl(serverUrl: string, launcherPort: number, tunnel = false): string | null {
  const m = /^(https?:\/\/)(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+)(?::\d{1,5})?\/?$/.exec(serverUrl.trim())
  if (!m || !Number.isInteger(launcherPort) || launcherPort < 1 || launcherPort > 65535) return null
  return tunnel ? `${serverUrl.trim().replace(/\/+$/, "")}/__oc/launcher` : `${m[1]}${m[2]}:${launcherPort}`
}

export type StartOutcome =
  | { kind: "started" } // the server is up and healthy
  | { kind: "failed"; reason: "unreachable" | "unauthorized" | "no-server" | "timeout" | "error"; detail?: string }

/** Interpret an HTTP status + JSON body from POST /start. */
export function interpretStart(status: number, body: unknown): StartOutcome {
  const b = (body ?? {}) as { ok?: boolean; error?: string; server?: { running?: boolean; healthy?: boolean } }
  if (status === 401 || status === 403) return { kind: "failed", reason: "unauthorized" }
  if (status === 429) return { kind: "failed", reason: "error", detail: "too many attempts, wait a minute" }
  if (status >= 200 && status < 300 && b.ok && b.server?.healthy) return { kind: "started" }
  if (status === 500 && typeof b.error === "string" && /did not become healthy/i.test(b.error)) return { kind: "failed", reason: "timeout", detail: b.error }
  if (status === 500 && typeof b.error === "string" && /no password/i.test(b.error)) return { kind: "failed", reason: "no-server", detail: b.error }
  return { kind: "failed", reason: "error", detail: typeof b.error === "string" ? b.error : `HTTP ${status}` }
}

/** Does the connection have what it needs to offer "start from the phone"? */
export function canStartFromPhone(conn: { launcherPort?: number } | null | undefined): boolean {
  return !!conn && Number.isInteger(conn.launcherPort) && (conn.launcherPort as number) > 0
}
