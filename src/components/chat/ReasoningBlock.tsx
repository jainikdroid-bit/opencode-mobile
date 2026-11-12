import { useEffect, useRef, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { formatElapsed, tailLines } from "../../lib/agent-phase"

interface Props {
  text: string
  isDark: boolean
  /** The model is reasoning right now: show a live, animated preview. */
  streaming?: boolean
  /** Time spent reasoning (finished parts), for the collapsed summary. */
  durationMs?: number
}

/** A bulb that breathes while the agent thinks. */
function ThinkingBulb({ active }: { active: boolean }) {
  const glow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    glow.setValue(0)
    if (!active) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [active, glow])

  return (
    <View style={s.bulbWrap}>
      {active ? (
        <Animated.View
          style={[
            s.bulbHalo,
            {
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.4] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.3] }) }],
            },
          ]}
        />
      ) : null}
      <Ionicons name={active ? "bulb" : "bulb-outline"} size={15} color="#ffb800" />
    </View>
  )
}

/** A thin bar that sweeps left to right under the live reasoning text. */
function SweepBar({ color }: { color: string }) {
  const sweep = useRef(new Animated.Value(0)).current
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [sweep])
  return (
    <View style={s.sweepTrack} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[
          s.sweepThumb,
          {
            backgroundColor: color,
            transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-60, Math.max(width, 60)] }) }],
          },
        ]}
      />
    </View>
  )
}

export function ReasoningBlock({ text, isDark, streaming = false, durationMs = 0 }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const label = streaming
    ? t("chat.reasoningBlock.live")
    : durationMs >= 1000
      ? t("chat.reasoningBlock.done", { time: formatElapsed(durationMs) })
      : t("chat.reasoningBlock.label")

  const showPreview = streaming && !expanded && text.trim().length > 0

  return (
    <TouchableOpacity
      style={[s.block, isDark && s.blockDark, streaming && s.blockLive, streaming && isDark && s.blockLiveDark]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.75}
      testID="reasoning-block"
    >
      <View style={s.header}>
        <ThinkingBulb active={streaming} />
        <Text style={[s.label, isDark && s.labelDark]}>{label}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={isDark ? "#8a93a8" : "#8a93a8"} />
      </View>
      {showPreview ? (
        <Text style={[s.preview, isDark && s.textDark]} numberOfLines={4}>
          {tailLines(text)}
        </Text>
      ) : null}
      {expanded ? (
        <Text style={[s.text, isDark && s.textDark]} selectable>
          {text}
        </Text>
      ) : null}
      {streaming ? <SweepBar color="#ffb800" /> : null}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  block: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fef3c7",
    overflow: "hidden",
  },
  blockDark: { backgroundColor: "#1a1a0a", borderColor: "#333300" },
  blockLive: { borderColor: "#fcd34d" },
  blockLiveDark: { borderColor: "#7a5b00" },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  bulbWrap: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  bulbHalo: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffb800" },
  label: { fontSize: 13, fontWeight: "600", color: "#92400e", flex: 1 },
  labelDark: { color: "#ffb800" },
  preview: { fontSize: 12, lineHeight: 18, color: "#a16207", marginTop: 8, fontStyle: "italic" },
  text: { fontSize: 13, lineHeight: 20, color: "#78350f", marginTop: 8 },
  textDark: { color: "#d4a574" },
  sweepTrack: { height: 3, borderRadius: 2, marginTop: 10, overflow: "hidden", backgroundColor: "rgba(245,158,11,0.15)" },
  sweepThumb: { width: 60, height: 3, borderRadius: 2 },
})
