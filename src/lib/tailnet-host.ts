// Pure helpers for the built-in Tailscale route (no React Native imports: runs under `node --test`).

/** True for addresses that only exist inside a tailnet: 100.64.0.0/10 and MagicDNS names (*.ts.net). */
export function isTailnetHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "")
  if (h.endsWith(".ts.net")) return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 100 && b >= 64 && b <= 127
}

export interface TailnetTarget {
  /** "host:port" as the tailnet node dials it */
  target: string
  /** the same URL pointed at the local end of the forward */
  rewrite: (localPort: number) => string
}

/** Split an http URL on a tailnet host into the forward target and a rewriter; null for any other URL. */
export function tailnetTarget(url: string): TailnetTarget | null {
  const m = /^(https?):\/\/([^/:?#\s]+)(?::(\d+))?(.*)$/i.exec(url)
  if (!m) return null
  const [, scheme, host, port, rest] = m
  if (!isTailnetHost(host)) return null
  // TLS to a MagicDNS name cannot be terminated on 127.0.0.1 (certificate mismatch): leave https alone.
  if (scheme.toLowerCase() === "https") return null
  return {
    target: `${host}:${port || "80"}`,
    rewrite: (localPort) => `http://127.0.0.1:${localPort}${rest}`,
  }
}
