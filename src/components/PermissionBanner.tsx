import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { usePathname } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { cyber } from "../theme/cyber"
import { useEvents } from "../stores/events"
import { bannerState, describePermission, sessionIdFromPath } from "../lib/permission-reply"
import { replyPermission } from "../lib/permission-actions"

// Approve or deny an agent's request from any screen, without opening the chat it came from.
export function PermissionBanner() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const pending = useEvents((s) => s.permissions)
  const state = bannerState(pending, sessionIdFromPath(pathname))
  if (!state) return null
  const { current, more } = state
  const reply = (r: "once" | "always" | "reject") => void replyPermission(current.sessionID, current.id, r)

  return (
    <View style={[s.wrap, { top: insets.top + 6 }]} pointerEvents="box-none" testID="permission-banner">
      <View style={s.card}>
        <View style={s.head}>
          <Ionicons name="shield-checkmark-outline" size={18} color={cyber.amber} />
          <Text style={s.title}>{t("chat.permissionPrompt.title")}</Text>
          {more > 0 ? <Text style={s.more}>{t("permissionBanner.more", { count: more })}</Text> : null}
        </View>
        <Text style={s.body} numberOfLines={3}>{describePermission(current)}</Text>
        <View style={s.actions}>
          <TouchableOpacity style={[s.btn, s.deny]} onPress={() => reply("reject")} testID="permission-deny">
            <Text style={s.denyText}>{t("chat.permissionPrompt.deny")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.always]} onPress={() => reply("always")}>
            <Text style={s.alwaysText}>{t("chat.permissionPrompt.always")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.allow]} onPress={() => reply("once")} testID="permission-allow">
            <Text style={s.allowText}>{t("chat.permissionPrompt.allow")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 8, right: 8, zIndex: 50 },
  card: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: cyber.amber, backgroundColor: cyber.surface, gap: 8, elevation: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, color: cyber.text, fontWeight: "700", fontSize: 14 },
  more: { color: cyber.muted, fontSize: 12 },
  body: { color: cyber.muted, fontSize: 12, fontFamily: cyber.mono },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  deny: { backgroundColor: "#2a0f16" },
  denyText: { color: "#f87171", fontWeight: "700" },
  always: { backgroundColor: "#141926" },
  alwaysText: { color: cyber.text, fontWeight: "600" },
  allow: { backgroundColor: cyber.cyan },
  allowText: { color: cyber.bg, fontWeight: "700" },
})
