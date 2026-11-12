// Local-vs-cloud classification for the model picker. Pure (no expo/react imports).
//
// "Local" = the model is served from the user's own machine or private network
// (llama.cpp, Ollama, LM Studio, ... on localhost, a LAN address or Tailscale),
// as opposed to a hosted API. The server tells us the endpoint URL (v2); older
// servers don't, so provider ids are matched as a fallback.

export type SourceFilter = "all" | "local" | "cloud"

const LOCAL_ID = /^(llama[.\-_]?cpp|llamacpp|ollama|lmstudio|lm-studio|local\b|koboldcpp|vllm-local|jan|gpt4all)/i

/** True for loopback, RFC1918, link-local, Tailscale (CGNAT / *.ts.net) and *.local hosts. */
export function isLocalUrl(url: string | undefined | null): boolean {
  if (!url) return false
  const match = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/?#]+)/i.exec(url.trim())
  if (!match) return false
  const host = match[1].replace(/^\[|\]$/g, "").toLowerCase()
  if (host === "localhost" || host === "::1" || host.endsWith(".localhost") || host.endsWith(".local")) return true
  if (host.endsWith(".ts.net")) return true
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!ip) return false
  const [a, b] = [Number(ip[1]), Number(ip[2])]
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

/**
 * A provider is local when every endpoint URL it reports is local; with no URLs
 * at all (older servers) the provider id decides.
 */
export function isLocalProvider(providerID: string, urls: ReadonlyArray<string | undefined | null> = []): boolean {
  const known = urls.filter((u): u is string => !!u)
  if (known.length > 0) return known.every(isLocalUrl)
  return LOCAL_ID.test(providerID)
}

export function matchesSource<T extends { local?: boolean }>(provider: T, filter: SourceFilter): boolean {
  if (filter === "all") return true
  return filter === "local" ? provider.local === true : provider.local !== true
}

export function countBySource(providers: ReadonlyArray<{ local?: boolean; models: readonly unknown[] }>) {
  let local = 0
  let cloud = 0
  for (const p of providers) {
    if (p.local) local += p.models.length
    else cloud += p.models.length
  }
  return { all: local + cloud, local, cloud }
}
