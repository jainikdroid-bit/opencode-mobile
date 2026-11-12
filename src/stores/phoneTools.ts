import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import {
  DEFAULT_PHONE_SETTINGS,
  parsePhoneSettings,
  pushAudit,
  type AuditEntry,
  type PhoneToolName,
  type PhoneToolSettings,
} from "../lib/phone-tools"

const PHONE_TOOLS_KEY = "opencode_phone_tools"

interface PhoneToolsState extends PhoneToolSettings {
  loaded: boolean
  log: AuditEntry[]
  load: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  setAllowed: (tool: PhoneToolName, allowed: boolean) => Promise<void>
  record: (entry: AuditEntry) => void
}

const persist = (s: PhoneToolSettings) => SecureStore.setItemAsync(PHONE_TOOLS_KEY, JSON.stringify({ enabled: s.enabled, allowed: s.allowed })).catch(() => {})

export const usePhoneTools = create<PhoneToolsState>((set, get) => ({
  ...DEFAULT_PHONE_SETTINGS,
  loaded: false,
  log: [],
  load: async () => {
    const raw = await SecureStore.getItemAsync(PHONE_TOOLS_KEY).catch(() => null)
    set({ ...parsePhoneSettings(raw), loaded: true })
  },
  setEnabled: async (enabled) => {
    set({ enabled })
    await persist(get())
  },
  setAllowed: async (tool, allowed) => {
    set({ allowed: { ...get().allowed, [tool]: allowed } })
    await persist(get())
  },
  record: (entry) => set({ log: pushAudit(get().log, entry) }),
}))
