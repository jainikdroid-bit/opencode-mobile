import { View, Text, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { cyber } from "../../theme/cyber"
import type { PlanEntry } from "../../lib/acp/protocol"

/** The agent's plan: its steps and how far along each is. */
export function PlanCard({ entries }: { entries: PlanEntry[] }) {
  const { t } = useTranslation()
  if (entries.length === 0) return null
  return (
    <View style={s.card} testID="acp-plan">
      <Text style={s.title}>{t("acp.plan")}</Text>
      {entries.map((entry, i) => (
        <View key={i} style={s.row}>
          <Ionicons
            name={entry.status === "completed" ? "checkmark-circle" : entry.status === "in_progress" ? "play-circle" : "ellipse-outline"}
            size={16}
            color={entry.status === "completed" ? cyber.green : entry.status === "in_progress" ? cyber.cyan : cyber.muted}
          />
          <Text style={[s.text, entry.status === "completed" && s.done]}>{entry.content}</Text>
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, borderColor: cyber.borderGlow, backgroundColor: cyber.surface, padding: 12, marginVertical: 4, gap: 6 },
  title: { color: cyber.cyan, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  text: { flex: 1, color: cyber.text, fontSize: 13 },
  done: { color: cyber.muted, textDecorationLine: "line-through" },
})
