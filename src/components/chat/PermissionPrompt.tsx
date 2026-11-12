import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

interface Props {
  permission: { id: string; permission: string; patterns: string[] }
  isDark: boolean
  onReply: (reply: "once" | "always" | "reject") => void
}

export function PermissionPrompt({ permission, isDark, onReply }: Props) {
  const { t } = useTranslation()
  return (
    <View style={[s.card, isDark && s.cardDark]}>
      <View style={s.header}>
        <Ionicons name="shield-outline" size={18} color="#ffb800" />
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.permissionPrompt.title")}</Text>
      </View>
      <Text style={[s.type, isDark && s.typeDark]}>
        {permission.permission}: {permission.patterns.join(", ")}
      </Text>
      <View style={s.actions}>
        <TouchableOpacity style={[s.btn, s.deny]} onPress={() => onReply("reject")}>
          <Text style={s.denyText}>{t("chat.permissionPrompt.deny")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.always, isDark && s.alwaysDark]} onPress={() => onReply("always")}>
          <Text style={[s.alwaysText, isDark && s.textWhite]}>{t("chat.permissionPrompt.always")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.allow, isDark && s.allowDark]} onPress={() => onReply("once")}>
          <Text style={[s.allowText, isDark && s.allowTextDark]}>{t("chat.permissionPrompt.allow")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    margin: 12,
    padding: 16,
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fef3c7",
  },
  cardDark: { backgroundColor: "#1a1800", borderColor: "#333300" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: "600", color: "#92400e" },
  textWhite: { color: "#ffffff" },
  type: { fontSize: 13, color: "#78350f", marginBottom: 12 },
  typeDark: { color: "#d4a574" },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  deny: { backgroundColor: "#2a0f16" },
  denyText: { color: "#dc2626", fontWeight: "600", fontSize: 14 },
  always: { backgroundColor: "#141926" },
  alwaysDark: { backgroundColor: "#1c2333" },
  alwaysText: { color: "#07080c", fontWeight: "600", fontSize: 14 },
  allow: { backgroundColor: "#07080c" },
  allowDark: { backgroundColor: "#22d3ee" },
  allowText: { color: "#ffffff", fontWeight: "600", fontSize: 14 },
  allowTextDark: { color: "#07080c" },
})
