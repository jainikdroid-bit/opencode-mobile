// Small client for the Files and Terminal screens: directory listing, file reading and
// PTY (terminal) management on the opencode server. Uses the same headers (Basic auth +
// x-opencode-directory) as the main client.
import { buildRequestHeaders } from "./headers"
import { ptySocketUrl } from "./server-tools"
import { routeUrl } from "./tailnet"

export interface ServerConn {
  baseUrl: string
  auth?: { username: string; password: string }
  /** Project directory on the server; relative paths below are resolved against it. */
  directory?: string
}

export interface RemoteEntry {
  name: string
  /** Relative path with "/" separators and no trailing slash. */
  path: string
  type: "file" | "directory"
  ignored: boolean
}

export interface RemoteFile {
  type: "text" | "binary"
  content: string
}

export interface PtyInfo {
  id: string
  title: string
  command: string
  cwd: string
  status: "running" | "exited"
}

const TIMEOUT_MS = 15_000

async function call<T>(conn: ServerConn, path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(await routeUrl(`${conn.baseUrl.replace(/\/+$/, "")}${path}`), {
      ...init,
      headers: { ...buildRequestHeaders({ directory: conn.directory, auth: conn.auth }), ...(init.headers as Record<string, string>) },
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`${response.status} ${body.slice(0, 160)}`.trim())
    }
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  } finally {
    clearTimeout(timer)
  }
}

/** "app\\build\\" -> "app/build". */
export function normalizeRemotePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\/+/, "").replace(/\/+$/, "")
}

export async function listFiles(conn: ServerConn, path: string): Promise<RemoteEntry[]> {
  const raw = await call<Array<{ name: string; path: string; type: "file" | "directory"; ignored?: boolean }>>(
    conn,
    `/file?path=${encodeURIComponent(path)}`,
  )
  return (raw ?? []).map((entry) => ({
    name: entry.name,
    path: normalizeRemotePath(entry.path),
    type: entry.type,
    ignored: !!entry.ignored,
  }))
}

export function readFile(conn: ServerConn, path: string): Promise<RemoteFile> {
  return call<RemoteFile>(conn, `/file/content?path=${encodeURIComponent(path)}`)
}

export function createPty(conn: ServerConn, options: { title?: string; command?: string } = {}): Promise<PtyInfo> {
  return call<PtyInfo>(conn, "/pty", {
    method: "POST",
    body: JSON.stringify({ title: options.title ?? "Phone", ...(options.command ? { command: options.command } : {}), ...(conn.directory ? { cwd: conn.directory } : {}) }),
  })
}

export async function resizePty(conn: ServerConn, id: string, cols: number, rows: number): Promise<void> {
  await call<unknown>(conn, `/pty/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ size: { rows, cols } }) })
}

export async function removePty(conn: ServerConn, id: string): Promise<void> {
  await call<unknown>(conn, `/pty/${encodeURIComponent(id)}`, { method: "DELETE" })
}

/**
 * WebSocket URL and headers for a PTY. React Native's WebSocket accepts a headers option.
 * The base goes through routeUrl like every other request: with built-in Tailscale a tailnet address
 * is only reachable through the node's local forward, and a direct socket would never connect.
 */
export async function ptySocket(conn: ServerConn, id: string): Promise<{ url: string; headers: Record<string, string> }> {
  const headers = buildRequestHeaders({ directory: conn.directory, auth: conn.auth })
  delete headers["Content-Type"]
  return { url: ptySocketUrl(await routeUrl(conn.baseUrl.replace(/\/+$/, "")), id), headers }
}
