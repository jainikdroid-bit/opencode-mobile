import { useEffect, useRef } from "react"
import { Animated, Easing, View } from "react-native"
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg"
import { cyber } from "../theme/cyber"

// RIG, the cyberpunk worker. One drawing, several moods:
//   idle      slow visor pulse, blinking antenna
//   thinking  visor eye scans left and right, thought dots rise above the hat
//   working   gear spins beside the head, sparks flicker, visor flashes
//   writing   visor shows typing bars
//   loading   eye scans, ring spins around the head
//   success   green smile in the visor
//   error     red cross in the visor, antenna goes red
export type MascotState = "idle" | "thinking" | "working" | "writing" | "loading" | "success" | "error"

const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)

interface Props {
  state?: MascotState
  size?: number
}

/** Loops 0 -> 1 -> 0 (ping-pong) or 0 -> 1 (restart) forever. */
function useLoop(duration: number, pingPong: boolean, enabled = true) {
  const value = useRef(new Animated.Value(0)).current
  useEffect(() => {
    value.setValue(0)
    if (!enabled) return
    const forward = Animated.timing(value, { toValue: 1, duration, easing: pingPong ? Easing.inOut(Easing.quad) : Easing.linear, useNativeDriver: false })
    const loop = Animated.loop(
      pingPong ? Animated.sequence([forward, Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: false })]) : forward,
    )
    loop.start()
    return () => loop.stop()
  }, [value, duration, pingPong, enabled])
  return value
}

export function Mascot({ state = "idle", size = 96 }: Props) {
  const scan = useLoop(state === "thinking" ? 520 : 700, true, state === "thinking" || state === "loading")
  const pulse = useLoop(900, true, state === "idle" || state === "working" || state === "writing")
  const blink = useLoop(700, true)
  const spin = useLoop(state === "loading" ? 1400 : 2200, false, state === "working" || state === "loading")
  const rise = useLoop(1200, false, state === "thinking")
  const type = useLoop(480, true, state === "writing")

  const accent = state === "error" ? cyber.red : state === "success" ? cyber.green : cyber.cyan
  const eyeX = scan.interpolate({ inputRange: [0, 1], outputRange: [41, 59] })
  const idleEye = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
  const antenna = blink.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] })
  const dot = (offset: number) =>
    rise.interpolate({ inputRange: [0, offset, Math.min(1, offset + 0.45), 1], outputRange: [0, 0, 1, 0], extrapolate: "clamp" })
  const degrees = spin.interpolate({ inputRange: [0, 1], outputRange: [0, 360] })
  const bar = (a: number, b: number) => type.interpolate({ inputRange: [0, 1], outputRange: [a, b] })

  const scanning = state === "thinking" || state === "loading"
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        {/* antenna */}
        <Line x1={88} y1={38} x2={99} y2={21} stroke={cyber.border} strokeWidth={3} strokeLinecap="round" />
        <AnimatedCircle cx={99} cy={19} r={3.4} fill={state === "error" ? cyber.red : cyber.magenta} opacity={antenna} />

        {/* body */}
        <Path d="M30 118 L30 101 Q30 94 38 93 L82 93 Q90 94 90 101 L90 118 Z" fill={cyber.surface} stroke={cyber.border} strokeWidth={2} />
        <Rect x={44} y={102} width={32} height={3} rx={1.5} fill={cyber.border} />
        <Circle cx={60} cy={110} r={3} fill={accent} />

        {/* head and headset */}
        <Rect x={28} y={50} width={64} height={44} rx={12} fill={cyber.surface} stroke={cyber.border} strokeWidth={2} />
        <Rect x={21} y={62} width={8} height={18} rx={4} fill={cyber.cyanDim} />
        <Rect x={91} y={62} width={8} height={18} rx={4} fill={cyber.cyanDim} />

        {/* visor */}
        <Rect x={35} y={59} width={50} height={20} rx={10} fill="#06141b" stroke={accent} strokeWidth={2} />
        {scanning ? (
          <AnimatedRect x={eyeX} y={65} width={20} height={8} rx={4} fill={accent} />
        ) : state === "writing" ? (
          <G>
            <AnimatedRect x={41} y={63} width={bar(10, 34)} height={3} rx={1.5} fill={accent} />
            <AnimatedRect x={41} y={69} width={bar(30, 14)} height={3} rx={1.5} fill={accent} opacity={0.7} />
          </G>
        ) : state === "success" ? (
          <Path d="M44 68 Q60 78 76 68" stroke={accent} strokeWidth={3} fill="none" strokeLinecap="round" />
        ) : state === "error" ? (
          <G stroke={accent} strokeWidth={3} strokeLinecap="round">
            <Line x1={52} y1={63} x2={68} y2={75} />
            <Line x1={68} y1={63} x2={52} y2={75} />
          </G>
        ) : (
          <G>
            <AnimatedRect x={41} y={65} width={20} height={8} rx={4} fill={accent} opacity={idleEye} />
            <Rect x={66} y={65} width={12} height={8} rx={4} fill={cyber.cyanDim} opacity={0.55} />
          </G>
        )}

        {/* vent */}
        <Rect x={48} y={85} width={24} height={2} rx={1} fill={cyber.muted} opacity={0.55} />
        <Rect x={52} y={89} width={16} height={2} rx={1} fill={cyber.muted} opacity={0.35} />

        {/* hard hat */}
        <Path d="M26 54 Q26 20 60 20 Q94 20 94 54 Z" fill="#0f2a36" stroke={accent} strokeWidth={2} />
        <Rect x={53} y={20} width={14} height={34} fill={cyber.magenta} opacity={0.9} />
        <Rect x={19} y={52} width={82} height={7} rx={3.5} fill={cyber.cyanDim} stroke={accent} strokeWidth={1.5} />

        {/* thought dots */}
        {state === "thinking" ? (
          <G>
            <AnimatedCircle cx={96} cy={14} r={2.6} fill={cyber.amber} opacity={dot(0)} />
            <AnimatedCircle cx={104} cy={8} r={3.2} fill={cyber.amber} opacity={dot(0.25)} />
            <AnimatedCircle cx={113} cy={5} r={4} fill={cyber.amber} opacity={dot(0.5)} />
          </G>
        ) : null}

        {/* gear for work / ring for loading */}
        {state === "working" ? (
          <G>
            <AnimatedG rotation={degrees} originX={16} originY={96}>
              <Circle cx={16} cy={96} r={9} fill="none" stroke={cyber.amber} strokeWidth={3} strokeDasharray="5 4" />
              <Circle cx={16} cy={96} r={3} fill={cyber.amber} />
            </AnimatedG>
            <Circle cx={104} cy={96} r={2} fill={cyber.amber} opacity={0.8} />
            <Circle cx={110} cy={88} r={1.5} fill={cyber.magenta} opacity={0.8} />
          </G>
        ) : null}
        {state === "loading" ? (
          <AnimatedG rotation={degrees} originX={60} originY={60}>
            <Circle cx={60} cy={60} r={56} fill="none" stroke={cyber.cyan} strokeWidth={2} strokeDasharray="20 70" strokeLinecap="round" />
          </AnimatedG>
        ) : null}
      </Svg>
    </View>
  )
}
