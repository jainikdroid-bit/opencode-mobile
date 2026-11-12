import { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet, Animated, Easing } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useEvents } from "../../stores/events"
import { useSessions } from "../../stores/sessions"
import { agentPhase, formatElapsed, type AgentPhase } from "../../lib/agent-phase"

interface Props {
  sessionID: string
  isDark: boolean
}

type IconName = keyof typeof Ionicons.glyphMap

const PHASE_ICON: Record<AgentPhase["kind"], IconName> = {
  thinking: "bulb",
  tool: "construct",
  writing: "create",
  working: "sparkles",
}

const PHASE_COLOR: Record<AgentPhase["kind"], string> = {
  thinking: "#f59e0b",
  tool: "#06b6d4",
  writing: "#22c55e",
  working: "#8b5cf6",
}

/** Three dots that rise and fade in turn: "the agent is busy" without a spinner. */
function BouncingDots({ color }: { color: string }) {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current
  useEffect(() => {
    const loops = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(Math.max(0, (2 - index) * 160)),
        ]),
      ),
    )
    loops.forEach((loop) => loop.start())
    return () => loops.forEach((loop) => loop.stop())
  }, [dots])

  return (
    <View style={s.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {dots.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            s.dot,
            {
              backgroundColor: color,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        />
      ))}
    </View>
  )
}

/** The phase icon inside a softly pulsing halo; the construct icon also turns. */
function PhaseOrb({ kind, color }: { kind: AgentPhase["kind"]; color: string }) {
  const pulse = useRef(new Animated.Value(0)).current
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const halo = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    )
    halo.start()
    return () => halo.stop()
  }, [pulse])

  useEffect(() => {
    spin.setValue(0)
    if (kind !== "tool") return
    const turn = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }))
    turn.start()
    return () => turn.stop()
  }, [kind, spin])

  return (
    <View style={s.orbWrap}>
      <Animated.View
        style={[
          s.halo,
          {
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.32] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] }) }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
        <Ionicons name={PHASE_ICON[kind]} size={18} color={color} />
      </Animated.View>
    </View>
  )
}

export function StatusIndicator({ sessionID, isDark }: Props) {
  const { t } = useTranslation()
  const status = useEvents((st) => st.sessionStatus[sessionID])
  const text = useEvents((st) => st.statusText[sessionID])
  const optimistic = useSessions((st) => st.sending[sessionID])
  // Newest message of this session: "waiting" while the user's prompt is still the
  // last thing (the model has not produced anything yet), else the assistant's parts.
  const latest = useSessions((st) => {
    for (let i = st.messages.length - 1; i >= 0; i--) {
      const message = st.messages[i]
      if (message.sessionID !== sessionID) continue
      return message.role === "assistant" ? st.parts[message.id] : "waiting"
    }
    return undefined
  })

  // SSE status is the source of truth. The optimistic `sending` flag only
  // covers the gap between the user tapping send and SSE confirming busy.
  // Once SSE reports idle, the indicator hides regardless of the optimistic flag.
  const sseBusy = status && status.type !== "idle"
  const busy = !!(sseBusy || (optimistic && !status))

  // Elapsed time since this run started being busy.
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!busy) {
      setStartedAt(null)
      return
    }
    setStartedAt((current) => current ?? Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [busy])

  // Slide/fade in when a run starts.
  const appear = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (busy) Animated.timing(appear, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    else appear.setValue(0)
  }, [busy, appear])

  if (!busy) return null

  const phase: AgentPhase =
    status?.type === "retry" ? { kind: "working" } : latest === "waiting" ? { kind: "thinking" } : agentPhase(latest)
  const color = PHASE_COLOR[phase.kind]
  let label: string
  if (status?.type === "retry") label = t("chat.statusIndicator.retrying", { attempt: status.attempt })
  else if (phase.kind === "thinking") label = t("chat.statusIndicator.thinking")
  else if (phase.kind === "tool") label = t("chat.statusIndicator.tool", { tool: phase.tool })
  else if (phase.kind === "writing") label = t("chat.statusIndicator.writing")
  else label = text || t("chat.statusIndicator.working")

  return (
    <Animated.View
      style={[
        s.bar,
        isDark && s.barDark,
        { borderTopColor: color, opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      testID="status-indicator"
    >
      <PhaseOrb kind={phase.kind} color={color} />
      <Text style={[s.text, isDark && s.textDark]} numberOfLines={1}>
        {label}
      </Text>
      <BouncingDots color={color} />
      <View style={s.spacer} />
      {startedAt ? <Text style={[s.elapsed, isDark && s.elapsedDark]}>{formatElapsed(now - startedAt)}</Text> : null}
    </Animated.View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: "#f8f7ff",
    borderTopWidth: 2,
  },
  barDark: { backgroundColor: "#15152a" },
  orbWrap: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 30, height: 30, borderRadius: 15 },
  text: { flexShrink: 1, fontSize: 14, color: "#4c1d95", fontWeight: "600" },
  textDark: { color: "#c4b5fd" },
  dots: { flexDirection: "row", alignItems: "center", gap: 4, height: 14, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  spacer: { flex: 1 },
  elapsed: { fontSize: 12, color: "#7c3aed", fontVariant: ["tabular-nums"] },
  elapsedDark: { color: "#a78bfa" },
})
