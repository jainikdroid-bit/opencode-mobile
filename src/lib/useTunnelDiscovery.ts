import { useEffect } from "react"
import { AppState } from "react-native"
import { useConnections } from "../stores/connections"
import { useEvents } from "../stores/events"
import { addressChange, isValidTopic, ntfyPollUrl, parseNtfyLatest } from "./tunnel-discovery"

const RETRY_MS = 45_000

// Tunnel mode: when the computer's tunnel address changes, learn the new one from the private ntfy topic and
// switch the saved connection to it. Checked on start, whenever the app comes to the front, and every 45 s
// while the connection is failing.
export function useTunnelDiscovery() {
  const connection = useConnections((s) => s.activeConnection)
  const id = connection?.id
  const topic = connection?.tunnelTopic

  useEffect(() => {
    if (!id || !isValidTopic(topic)) return
    let stopped = false
    let busy = false

    const check = async () => {
      if (busy || stopped) return
      busy = true
      try {
        const res = await fetch(ntfyPollUrl(topic))
        if (!res.ok) return
        const current = useConnections.getState().activeConnection
        if (!current || current.id !== id) return
        const next = addressChange(current.url, parseNtfyLatest(await res.text()))
        if (next) await useConnections.getState().updateConnection(id, { url: next })
      } catch {
        /* offline: try again later */
      } finally {
        busy = false
      }
    }

    void check()
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check()
    })
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && useEvents.getState().reconnectAttempts > 0) void check()
    }, RETRY_MS)
    return () => {
      stopped = true
      sub.remove()
      clearInterval(timer)
    }
  }, [id, topic])
}
