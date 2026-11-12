import { memo, useCallback, useEffect, useRef, useState } from "react"
import { View, Text, Pressable, StyleSheet } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useTranslation } from "react-i18next"
import { Mascot } from "./Mascot"
import { cyber } from "../theme/cyber"
import { CONFIG, jump, newGame, score, step, type GameState, type Obstacle } from "../lib/runner-game"

const BEST_KEY = "rig_run_best"
const FIELD_HEIGHT = 170
const GROUND = 26 // px of ground strip below the running line

type Phase = "ready" | "playing" | "over"

const Player = memo(function Player({ phase }: { phase: Phase }) {
  return <Mascot state={phase === "over" ? "error" : phase === "playing" ? "working" : "idle"} size={CONFIG.playerH + 4} />
})

function ObstacleView({ o }: { o: Obstacle }) {
  const base = { left: o.x, bottom: GROUND, width: o.w, height: o.h }
  if (o.kind === "cable") {
    return (
      <View style={[s.cable, base]}>
        <View style={s.spark} />
      </View>
    )
  }
  const leds = Math.max(2, Math.floor(o.h / 14))
  return (
    <View style={[s.rack, base]}>
      {Array.from({ length: leds }, (_, i) => (
        <View key={i} style={[s.led, { backgroundColor: i % 2 ? cyber.magenta : cyber.cyan }]} />
      ))}
    </View>
  )
}

// RIG RUN: tap to jump over server racks and live cables. Best score is kept on the device.
export function RunnerGame() {
  const { t } = useTranslation()
  const [width, setWidth] = useState(320)
  const [phase, setPhase] = useState<Phase>("ready")
  const [frame, setFrame] = useState<GameState>(newGame)
  const [best, setBest] = useState(0)
  const [quip, setQuip] = useState(0)

  const game = useRef<GameState>(frame)
  const last = useRef(0)
  const raf = useRef<number | null>(null)
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY)
      .then((v) => setBest(Number(v) || 0))
      .catch(() => {})
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [])

  const tick = useCallback((now: number) => {
    const dt = last.current ? (now - last.current) / 1000 : 0
    last.current = now
    const next = step(game.current, dt, widthRef.current)
    game.current = next
    setFrame(next)
    if (!next.alive) {
      raf.current = null
      setPhase("over")
      setQuip(Math.floor(next.distance) % 4)
      const finalScore = score(next)
      setBest((current) => {
        if (finalScore > current) {
          AsyncStorage.setItem(BEST_KEY, String(finalScore)).catch(() => {})
          return finalScore
        }
        return current
      })
      return
    }
    raf.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(() => {
    game.current = newGame()
    last.current = 0
    setFrame(game.current)
    setPhase("playing")
    raf.current = requestAnimationFrame(tick)
  }, [tick])

  const onPress = () => {
    if (phase === "playing") {
      game.current = jump(game.current)
    } else {
      start()
    }
  }

  const x = CONFIG.playerX
  return (
    <Pressable style={s.field} onPress={onPress} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID="runner-game">
      <Text style={s.title}>{t("game.title")}</Text>
      <Text style={s.score} testID="runner-score">
        {String(score(frame)).padStart(5, "0")}  ·  {t("game.best")} {String(best).padStart(5, "0")}
      </Text>

      <View style={[s.ground, { bottom: GROUND - 2 }]} />
      {frame.obstacles.map((o, i) => (
        <ObstacleView key={i} o={o} />
      ))}
      <View style={{ position: "absolute", left: x - 6, bottom: GROUND + frame.y - 2 }}>
        <Player phase={phase} />
      </View>

      {phase !== "playing" ? (
        <View style={s.overlay} pointerEvents="none">
          {phase === "over" ? <Text style={s.over}>{t("game.over")}</Text> : null}
          {phase === "over" ? <Text style={s.quip}>{t(`game.quip${quip + 1}`)}</Text> : null}
          <Text style={s.hint}>{phase === "over" ? t("game.retry") : t("game.start")}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const s = StyleSheet.create({
  field: {
    width: "100%",
    height: FIELD_HEIGHT,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: cyber.borderGlow,
    backgroundColor: cyber.surface,
    borderRadius: 6,
  },
  title: { position: "absolute", left: 10, top: 8, color: cyber.cyan, fontFamily: cyber.mono, fontSize: 11, letterSpacing: 2 },
  score: { position: "absolute", right: 10, top: 8, color: cyber.muted, fontFamily: cyber.mono, fontSize: 11 },
  ground: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: cyber.borderGlow },
  rack: {
    position: "absolute",
    backgroundColor: cyber.surface2,
    borderWidth: 1,
    borderColor: cyber.cyanDim,
    borderRadius: 2,
    justifyContent: "space-evenly",
    paddingHorizontal: 4,
  },
  led: { height: 3, borderRadius: 1.5 },
  cable: { position: "absolute", backgroundColor: cyber.magenta, borderRadius: 3, opacity: 0.9, alignItems: "flex-end" },
  spark: { width: 6, height: 6, borderRadius: 3, backgroundColor: cyber.amber, margin: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(7,8,12,0.55)", paddingHorizontal: 16 },
  over: { color: cyber.red, fontFamily: cyber.mono, fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  quip: { color: cyber.text, fontSize: 12, textAlign: "center", marginTop: 6, marginBottom: 8 },
  hint: { color: cyber.cyan, fontFamily: cyber.mono, fontSize: 12 },
})
