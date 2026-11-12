import { useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

interface Props {
  isDark: boolean
  /** Tapping a suggestion puts its text in the message box (it is not sent). */
  onPick: (text: string) => void
}

const SUGGESTIONS = ["explain", "bugs", "tests", "changes"] as const

/** Friendly start screen: a gently floating icon and one-tap conversation starters. */
export function EmptyState({ isDark, onPick }: Props) {
  const { t } = useTranslation()
  const float = useRef(new Animated.Value(0)).current
  const appear = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [appear, float])

  return (
    <Animated.View style={[s.wrap, { opacity: appear }]} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
        <View style={[s.iconBubble, isDark && s.iconBubbleDark]}>
          <Ionicons name="sparkles" size={34} color="#8b5cf6" />
        </View>
      </Animated.View>
      <Text style={[s.title, isDark && s.titleDark]}>{t("session.empty.title")}</Text>
      <Text style={[s.hint, isDark && s.hintDark]}>{t("session.empty.hint")}</Text>
      <View style={s.chips}>
        {SUGGESTIONS.map((key) => {
          const text = t(`session.empty.suggestions.${key}`)
          return (
            <TouchableOpacity
              key={key}
              style={[s.chip, isDark && s.chipDark]}
              onPress={() => onPick(text)}
              activeOpacity={0.7}
              testID={`empty-suggestion-${key}`}
            >
              <Text style={[s.chipText, isDark && s.chipTextDark]}>{text}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  iconBubble: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#f3effe", alignItems: "center", justifyContent: "center" },
  iconBubbleDark: { backgroundColor: "#241b3d" },
  title: { fontSize: 20, fontWeight: "700", color: "#1f1f1f", marginTop: 16 },
  titleDark: { color: "#ffffff" },
  hint: { fontSize: 14, color: "#888888", marginTop: 4 },
  hintDark: { color: "#777777" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 22 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: "#e0d8fb", backgroundColor: "#faf8ff" },
  chipDark: { borderColor: "#3b2f66", backgroundColor: "#1c1730" },
  chipText: { fontSize: 14, color: "#5b3fb5" },
  chipTextDark: { color: "#c4b5fd" },
})
