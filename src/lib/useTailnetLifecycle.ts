import { useEffect } from "react"
import { AppState } from "react-native"
import { useTailnet } from "../stores/tailnet"
import { tailnetNetworkChanged } from "./tailnet"

// Starts the built-in Tailscale node on launch (when the user turned it on) and, each time the app
// comes back to the front, lets the node re-read the network: the phone may have switched Wi-Fi/mobile.
export function useTailnetLifecycle() {
  useEffect(() => {
    void useTailnet.getState().load()
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tailnetNetworkChanged()
    })
    return () => sub.remove()
  }, [])
}
