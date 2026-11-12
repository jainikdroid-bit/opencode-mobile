import { useMemo } from "react"
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Keyboard, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

export interface SlashCommand {
  trigger: string
  title: string
  description?: string
  icon: string
  type: "builtin" | "custom"
}

interface Props {
  query: string
  commands: SlashCommand[]
  isDark: boolean
  onSelect: (cmd: SlashCommand) => void
}

export function SlashPopover({ query, commands, isDark, onSelect }: Props) {
  const { t } = useTranslation()
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return commands.filter((c) => c.trigger.toLowerCase().startsWith(q) || c.title.toLowerCase().includes(q))
  }, [query, commands])

  if (filtered.length === 0) return null

  return (
    <View style={[s.popover, isDark && s.popoverDark]}>
      <ScrollView keyboardShouldPersistTaps="always" style={s.scroll}>
        {filtered.map((cmd) => (
          <TouchableOpacity key={cmd.trigger} style={[s.item, isDark && s.itemDark]} onPress={() => onSelect(cmd)}>
            <Ionicons
              name={cmd.icon as any}
              size={18}
              color={cmd.type === "custom" ? "#22d3ee" : isDark ? "#8a93a8" : "#8a93a8"}
            />
            <View style={s.textCol}>
              <Text style={[s.trigger, isDark && s.textWhite]}>/{cmd.trigger}</Text>
              {cmd.description && (
                <Text style={[s.desc, isDark && s.metaDark]} numberOfLines={1}>
                  {cmd.description}
                </Text>
              )}
            </View>
            {cmd.type === "custom" && (
              <View style={[s.badge, isDark && s.badgeDark]}>
                <Text style={s.badgeText}>{t("chat.slashPopover.customBadge")}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  popover: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#1c2333",
    maxHeight: 220,
  },
  popoverDark: { backgroundColor: "#0d1018", borderTopColor: "#1c2333" },
  scroll: { paddingVertical: 4 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  itemDark: {},
  textCol: { flex: 1 },
  trigger: { fontSize: 14, fontWeight: "600", color: "#07080c" },
  textWhite: { color: "#ffffff" },
  desc: { fontSize: 12, color: "#8a93a8", marginTop: 1 },
  metaDark: { color: "#8a93a8" },
  badge: {
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDark: { backgroundColor: "#0f2230" },
  badgeText: { fontSize: 10, color: "#22d3ee", fontWeight: "600" },
})
