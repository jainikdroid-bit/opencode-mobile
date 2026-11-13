import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { cyber } from "../../theme/cyber"
import type { PermissionRequest } from "../../lib/acp/protocol"

/** The agent asks before it acts: one button per option the agent offered (allow once / always, reject). */
export function PermissionCard({ request, agent, onAnswer }: { request: PermissionRequest; agent: string; onAnswer: (optionId: string) => void }) {
  const { t } = useTranslation()
  return (
    <View style={s.card} testID="acp-permission">
      <View style={s.head}>
        <Ionicons name="shield-outline" size={18} color={cyber.amber} />
        <Text style={s.title}>{t("acp.permissionTitle", { agent })}</Text>
      </View>
      {request.title ? <Text style={s.what}>{request.title}</Text> : null}
      <View style={s.actions}>
        {request.options.map((option) => {
          const allow = option.kind === "allow_once" || option.kind === "allow_always"
          return (
            <TouchableOpacity key={option.optionId} style={[s.btn, allow ? s.allow : s.reject]} onPress={() => onAnswer(option.optionId)} testID={`acp-permission-${option.kind}`}>
              <Text style={allow ? s.allowText : s.rejectText}>{option.name}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: { margin: 12, padding: 14, backgroundColor: "#1a1800", borderRadius: 12, borderWidth: 1, borderColor: "#333300", gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: cyber.text, fontSize: 15, fontWeight: "600" },
  what: { color: "#d4a574", fontSize: 13, fontFamily: cyber.mono },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: "center" },
  allow: { backgroundColor: cyber.cyan },
  allowText: { color: cyber.bg, fontWeight: "700", fontSize: 14 },
  reject: { backgroundColor: "#2a0f16" },
  rejectText: { color: cyber.red, fontWeight: "600", fontSize: 14 },
})
