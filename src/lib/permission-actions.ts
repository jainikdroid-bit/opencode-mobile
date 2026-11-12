import { Alert } from "react-native"
import i18n from "./i18n/config"
import { useConnections } from "../stores/connections"
import { useEvents } from "../stores/events"
import type { PermissionReply } from "./permission-reply"

// Answer a pending permission from outside the chat screen (banner or notification button).
// Optimistic like the in-chat prompt: the card disappears at once and comes back if the server refuses.
export async function replyPermission(sessionID: string, requestID: string, reply: PermissionReply, quiet = false): Promise<void> {
  const client = useConnections.getState().client
  if (!client) return
  const snapshot = useEvents.getState().permissions[sessionID] || []
  useEvents.setState((state) => ({
    permissions: { ...state.permissions, [sessionID]: snapshot.filter((p) => p.id !== requestID) },
  }))
  try {
    await client.permission.reply(requestID, reply)
  } catch (error) {
    console.error("Permission reply failed:", error)
    useEvents.setState((state) => ({ permissions: { ...state.permissions, [sessionID]: snapshot } }))
    if (!quiet) Alert.alert(i18n.t("session.alerts.replyFailedTitle"), i18n.t("session.alerts.replyFailedMessage"))
  }
}
