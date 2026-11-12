// Tunnel mode: the computer's free tunnel gets a new address whenever it restarts. The computer announces the address
// on a private ntfy.sh topic (known only to the paired phone); this reads the newest announcement. Pure helpers only.

const TOPIC = /^[A-Za-z0-9_-]{16,64}$/
const ADDRESS = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i

export const isValidTopic = (topic: unknown): topic is string => typeof topic === "string" && TOPIC.test(topic)

/** Newest valid address in an ntfy JSON-lines response, or null. */
export function parseNtfyLatest(body: string): string | null {
  let best: { time: number; url: string } | null = null
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as { event?: string; message?: string; time?: number }
      const url = (event.message ?? "").trim().replace(/\/+$/, "")
      if (event.event === "message" && ADDRESS.test(url) && (!best || (event.time ?? 0) >= best.time)) best = { time: event.time ?? 0, url: url.toLowerCase() }
    } catch {
      /* ignore garbage lines */
    }
  }
  return best ? best.url : null
}

export const ntfyPollUrl = (topic: string) => `https://ntfy.sh/${topic}/json?poll=1&since=all`

/** Address to switch to, or null when the saved one is already current (or nothing valid was announced). */
export function addressChange(saved: string, announced: string | null): string | null {
  return announced && announced !== saved.replace(/\/+$/, "").toLowerCase() ? announced : null
}

/** In tunnel mode the launcher and bridge live under paths of the one public address. */
export const tunnelLauncherUrl = (serverUrl: string) => `${serverUrl.replace(/\/+$/, "")}/__oc/launcher`
export const tunnelBridgeUrl = (serverUrl: string) => `${serverUrl.replace(/\/+$/, "")}/__oc/bridge`
