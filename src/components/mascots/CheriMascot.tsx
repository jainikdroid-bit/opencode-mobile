import { memo } from "react"
import { Animated, Pressable, View } from "react-native"
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg"
import { faceFor } from "../../lib/cheri-antics"
import { Blush, Brows, CHERI as C, Eyes, Mouth, type BrowKind } from "./cheriFace"
import { HeadScene, Scene, earMotion, glance, headMotion, yawnHeight } from "./cheriScenes"
import type { MascotProps, MascotState } from "./types"
import { useAntics } from "./useAntics"
import { useBlink, useLoop } from "./useLoop"

// Cheri, the cat-eared girl in a headset (the default mascot since 0.16). The ear LEDs,
// the choker light and her face carry the mood:
//   idle      blinks now and then, ear LEDs breathe pink
//   thinking  looks up, ear LEDs blink amber, thought dots rise
//   working   ear LEDs pulse cyan, a gear spins at her shoulder
//   writing   looks down at a hologram panel that fills with typing bars
//   loading   eyes scan left and right, a ring spins around her
//   success   happy closed eyes, open smile, green LEDs and sparkles
//   error     worried brows, small "o" mouth, ear LEDs flash red, a "!" blinks
//   offline   ears droop, sleepy eyes, grey LEDs and a "?"
// On top of that she plays little antics (see lib/cheri-antics.ts): yawns, bubble gum, coffee,
// "nya~", sneezes, music, glitches, naps, sweat, confetti, a rain cloud, and reactions to taps.

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon)

const LED: Record<MascotState, string> = {
  idle: C.hair,
  thinking: C.amber,
  working: C.cyan,
  writing: C.cyan,
  loading: C.cyan,
  success: C.green,
  error: C.red,
  offline: C.grey,
}

// The head is drawn on the sketch grid and scaled 1.12x about (60,46), shifted down 6.
const HEAD = "translate(-7.2 0.48) scale(1.12)"

const EARS_UP = { left: "43,24 44,5 56,17", right: "77,24 76,5 64,17", innerL: "46,19 47,11 52,16", innerR: "74,19 73,11 68,16" }
const EARS_DOWN = { left: "44,24 28,20 54,17", right: "76,24 92,20 66,17", innerL: "45,22 34,20 50,19", innerR: "75,22 86,20 70,19" }

function browsFor(state: MascotState, antic: ReturnType<typeof useAntics>["antic"]): BrowKind {
  if (antic === "pout") return "angry"
  if (antic === "storm" || antic === "sweat" || antic === "dizzy" || state === "error") return "worried"
  if (state === "thinking" || antic === "lookAround") return "raised"
  return "normal"
}

function CheriImpl({ state = "idle", size = 96, interactive = false, calm = false }: MascotProps) {
  const { antic, progress, tap } = useAntics(state, calm)
  const face = faceFor(state, antic)

  const blink = useBlink(state === "thinking" ? 1800 : 2800, face.eyes === "open" || face.eyes === "wink" || face.eyes === "look")
  const pulse = useLoop(state === "error" || state === "thinking" ? 320 : 900, true, state !== "offline")
  const scan = useLoop(700, true, state === "loading")
  const spin = useLoop(state === "loading" ? 1400 : 2200, false, state === "working" || state === "loading")
  const rise = useLoop(1200, false, state === "thinking")
  const type = useLoop(480, true, state === "writing")

  const led = LED[state]
  const ears = state === "offline" && antic !== "sneeze" ? EARS_DOWN : EARS_UP
  const ledOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: state === "offline" ? [0.6, 0.6] : [0.45, 1] })
  const degrees = spin.interpolate({ inputRange: [0, 1], outputRange: [0, 360] })
  const dot = (offset: number) =>
    rise.interpolate({ inputRange: [0, offset, Math.min(1, offset + 0.45), 1], outputRange: [0, 0, 1, 0], extrapolate: "clamp" })
  const bar = (a: number, b: number) => type.interpolate({ inputRange: [0, 1], outputRange: [a, b] })

  const look = glance(antic, progress)
  const eyeDx = look ?? (state === "loading" ? scan.interpolate({ inputRange: [0, 1], outputRange: [-1.6, 1.6] }) : state === "thinking" ? 1 : 0)
  const eyeDy = antic ? 0 : state === "thinking" ? -1.2 : state === "writing" ? 1.2 : 0
  const { bob, jitter } = headMotion(antic, progress)
  const { twitch, hop } = earMotion(antic, progress)

  const drawing = (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={56} fill={C.bg} />

      {/* long hair behind the shoulders */}
      <G transform={HEAD}>
        <AnimatedG rotation={bob} originX={60} originY={60} x={jitter}>
          <Path d="M34 104 Q24 60 34 34 Q46 18 62 20 Q86 22 88 50 Q92 80 84 104 Z" fill={C.hair} />
        </AnimatedG>
      </G>

      {/* shoulders, top, jacket, neck and choker */}
      <Path d="M27 120 Q27 100 49 94 L71 94 Q93 100 93 120 Z" fill={C.skin} />
      <Path d="M45 120 L46 108 Q60 103 74 108 L75 120 Z" fill={C.top} />
      <Path d="M19 120 Q21 108 35 104 L43 120 Z M101 120 Q99 108 85 104 L77 120 Z" fill={C.jacket} stroke={C.jacketEdge} strokeWidth={1.5} />
      <Rect x={53.4} y={72} width={13.2} height={24} fill={C.skin} />
      <Rect x={52.4} y={83} width={15.2} height={4} rx={2} fill={C.choker} />
      <AnimatedCircle cx={60} cy={85} r={1.6} fill={led} opacity={ledOpacity} />

      {/* head */}
      <G transform={HEAD}>
        <AnimatedG rotation={bob} originX={60} originY={60} x={jitter}>
          <Path d="M44 44 Q44 66 60 71 Q76 66 76 44 Q76 26 60 26 Q44 26 44 44 Z" fill={C.skin} />
          <Brows kind={browsFor(state, antic)} />
          <Eyes kind={face.eyes} motion={{ dx: eyeDx, dy: eyeDy, blink }} />
          <Blush kind={face.blush} />
          <Path d="M60 53.5 L59.2 56.5 L61 56.5" stroke={C.nose} strokeWidth={1} fill="none" />
          <Mouth kind={face.mouth} yawn={yawnHeight(progress)} />
          <HeadScene antic={antic} p={progress} />
          <Path d="M42 50 Q40 22 60 22 Q80 22 78 50 Q74 30 60 28 Q46 30 42 50 Z" fill={C.hair} />
          {/* headset with cat ears; the inner ear is the status LED */}
          <AnimatedG y={hop}>
            <Path d="M41 40 Q41 14 60 14 Q79 14 79 40" stroke={C.headset} strokeWidth={3} fill="none" />
            <AnimatedG rotation={twitch} originX={50} originY={21}>
              <Polygon points={ears.left} fill="#fff" stroke={C.headset} strokeWidth={1.5} />
              <AnimatedPolygon points={ears.innerL} fill={led} opacity={ledOpacity} />
            </AnimatedG>
            <Polygon points={ears.right} fill="#fff" stroke={C.headset} strokeWidth={1.5} />
            <AnimatedPolygon points={ears.innerR} fill={led} opacity={ledOpacity} />
          </AnimatedG>
        </AnimatedG>
      </G>

      {state === "thinking" && !antic ? (
        <G>
          <AnimatedCircle cx={96} cy={18} r={2.6} fill={C.amber} opacity={dot(0)} />
          <AnimatedCircle cx={104} cy={11} r={3.2} fill={C.amber} opacity={dot(0.25)} />
          <AnimatedCircle cx={113} cy={6} r={4} fill={C.amber} opacity={dot(0.5)} />
        </G>
      ) : null}

      {state === "writing" ? (
        <G>
          <Rect x={88} y={62} width={28} height={20} rx={3} fill={C.cyan} opacity={0.18} stroke={C.cyan} strokeWidth={1.2} />
          <AnimatedRect x={92} y={67} width={bar(6, 20)} height={2.5} rx={1.2} fill={C.cyan} />
          <AnimatedRect x={92} y={73} width={bar(16, 8)} height={2.5} rx={1.2} fill={C.cyan} opacity={0.7} />
        </G>
      ) : null}

      {state === "working" ? (
        <AnimatedG rotation={degrees} originX={14} originY={100}>
          <Circle cx={14} cy={100} r={8} fill="none" stroke={C.amber} strokeWidth={3} strokeDasharray="4 3.5" />
          <Circle cx={14} cy={100} r={2.6} fill={C.amber} />
        </AnimatedG>
      ) : null}

      {state === "loading" ? (
        <AnimatedG rotation={degrees} originX={60} originY={60}>
          <Circle cx={60} cy={60} r={57} fill="none" stroke={C.cyan} strokeWidth={2} strokeDasharray="20 70" strokeLinecap="round" />
        </AnimatedG>
      ) : null}

      {state === "success" && !antic ? (
        <AnimatedG opacity={ledOpacity}>
          <Path d="M98 22 L100 27 L105 29 L100 31 L98 36 L96 31 L91 29 L96 27 Z" fill={C.amber} />
          <Path d="M20 34 L21.2 37 L24 38 L21.2 39 L20 42 L18.8 39 L16 38 L18.8 37 Z" fill={C.cyan} />
        </AnimatedG>
      ) : null}

      {(state === "error" || state === "offline") && !antic ? (
        <AnimatedG opacity={ledOpacity}>
          <SvgText x={98} y={26} fill={state === "error" ? C.red : C.amber} fontSize={18} fontWeight="bold">
            {state === "error" ? "!" : "?"}
          </SvgText>
        </AnimatedG>
      ) : null}
      {state === "offline" ? <Line x1={84} y1={112} x2={98} y2={112} stroke={C.grey} strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" /> : null}

      <Scene antic={antic} p={progress} />
    </Svg>
  )

  if (interactive) {
    return (
      <Pressable onPress={tap} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cheri" style={{ width: size, height: size }}>
        {drawing}
      </Pressable>
    )
  }
  return <View style={{ width: size, height: size }}>{drawing}</View>
}

/** Memoised so a parent that re-renders every frame (the runner game) does not re-render Cheri. */
export const CheriMascot = memo(CheriImpl)
