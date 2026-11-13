import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { Linking } from "react-native"
import { setTailnetEnabled, tailnetAvailable, tailnetLogout, tailnetStatus, type TailnetStatus } from "../lib/tailnet"

const TAILNET_KEY = "opencode_tailnet"
const POLL_PENDING_MS = 1_500
const POLL_READY_MS = 15_000

interface TailnetState {
  loaded: boolean
  /** the native library exists on this device (Android builds only) */
  available: boolean
  enabled: boolean
  status: TailnetStatus | null
  load: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  /** open the Tailscale sign-in page, once the node has produced its link */
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  /** resolves true when the node is connected, false on timeout or when turned off */
  waitReady: (timeoutMs: number) => Promise<boolean>
}

let timer: ReturnType<typeof setTimeout> | null = null
let openedAuthUrl = ""

export const useTailnet = create<TailnetState>((set, get) => {
  const poll = async () => {
    timer = null
    if (!get().enabled) return
    const status = await tailnetStatus()
    set({ status })
    timer = setTimeout(poll, status?.ready ? POLL_READY_MS : POLL_PENDING_MS)
  }
  const restartPolling = () => {
    if (timer) clearTimeout(timer)
    timer = null
    void poll()
  }

  return {
    loaded: false,
    available: false,
    enabled: false,
    status: null,

    load: async () => {
      if (get().loaded) return
      const available = await tailnetAvailable()
      const raw = await SecureStore.getItemAsync(TAILNET_KEY).catch(() => null)
      const enabled = available && raw === "on"
      set({ loaded: true, available, enabled })
      if (enabled) {
        await setTailnetEnabled(true).catch(() => undefined)
        restartPolling()
      }
    },

    setEnabled: async (enabled) => {
      const on = enabled && get().available
      set({ enabled: on, status: on ? get().status : null })
      await SecureStore.setItemAsync(TAILNET_KEY, on ? "on" : "off").catch(() => undefined)
      await setTailnetEnabled(on).catch(() => undefined)
      if (on) restartPolling()
    },

    signIn: async () => {
      const url = get().status?.authUrl
      if (!url) return
      openedAuthUrl = url
      await Linking.openURL(url).catch(() => undefined)
    },

    signOut: async () => {
      await tailnetLogout()
      openedAuthUrl = ""
      restartPolling()
    },

    waitReady: async (timeoutMs) => {
      const until = Date.now() + timeoutMs
      while (Date.now() < until) {
        const { enabled, status } = get()
        if (!enabled) return false
        if (status?.ready) return true
        // First time the sign-in link shows up during a wait the user asked for: open it for them.
        if (status?.authUrl && status.authUrl !== openedAuthUrl) await get().signIn()
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      return false
    },
  }
})
