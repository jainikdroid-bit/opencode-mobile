import { Animated } from "react-native"
import { Circle, Ellipse, G, Path } from "react-native-svg"
import type { EyeKind, Face, MouthKind } from "../../lib/cheri-antics"

// Cheri's face parts, drawn on the head grid (see CheriMascot's HEAD transform).

export const CHERI = {
  bg: "#FBEAF0",
  skin: "#F5C4B3",
  hair: "#ED93B1",
  headset: "#993556",
  top: "#993556",
  jacket: "#F4C0D1",
  jacketEdge: "#D4537E",
  line: "#4B1528",
  iris: "#378ADD",
  lips: "#D4537E",
  blush: "#F4C0D1",
  blushStrong: "#ED93B1",
  nose: "#F0997B",
  choker: "#2C2C2A",
  cyan: "#22d3ee",
  magenta: "#e879f9",
  amber: "#EF9F27",
  green: "#1D9E75",
  red: "#E24B4A",
  grey: "#888780",
  tear: "#85B7EB",
  tearEdge: "#378ADD",
} as const

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Num = number | Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number>

function lash(x: number) {
  return <Path d={`M${x - 5} 47.5 Q${x} 43.5 ${x + 5} 47.5 L${x + 7} 46`} stroke={CHERI.line} strokeWidth={1.8} fill="none" strokeLinecap="round" />
}

function OpenEye({ x, dx, dy, ry, shine }: { x: number; dx: Num; dy: number; ry: Num; shine: Num }) {
  const cx = typeof dx === "number" ? x + dx : Animated.add(dx, x)
  const hx = typeof dx === "number" ? x + dx + 1.2 : Animated.add(dx, x + 1.2)
  return (
    <G>
      <AnimatedEllipse cx={cx} cy={50 + dy} rx={3.4} ry={ry} fill={CHERI.iris} />
      <AnimatedCircle cx={hx} cy={48.4 + dy} r={1.3} fill="#fff" opacity={shine} />
      {lash(x)}
    </G>
  )
}

export interface EyeMotion {
  /** Horizontal iris shift (scan while loading, glance during lookAround). */
  dx: Num
  /** Vertical iris shift: up while thinking, down while writing. */
  dy: number
  /** 1 = open, 0 = shut. */
  blink: Animated.Value
}

export function Eyes({ kind, motion }: { kind: EyeKind; motion: EyeMotion }) {
  const stroke = { stroke: CHERI.line, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const }
  switch (kind) {
    case "happy":
      return <Path d="M47 50 Q51 45.5 55 50M65 50 Q69 45.5 73 50" {...stroke} />
    case "closed":
      return <Path d="M46.5 49.5 Q51 52 55.5 49.5M64.5 49.5 Q69 52 73.5 49.5" {...stroke} />
    case "squeeze":
      return <Path d="M47 46.5 L54 49.5 L47 52.5M73 46.5 L66 49.5 L73 52.5" {...stroke} />
    case "spiral":
      return (
        <G stroke={CHERI.line} strokeWidth={1.3} fill="none">
          <Circle cx={51} cy={50} r={3.8} />
          <Circle cx={51} cy={50} r={1.7} />
          <Circle cx={69} cy={50} r={3.8} />
          <Circle cx={69} cy={50} r={1.7} />
        </G>
      )
    case "narrow":
      return (
        <G>
          <Ellipse cx={51} cy={51} rx={3.2} ry={2} fill={CHERI.iris} />
          <Ellipse cx={69} cy={51} rx={3.2} ry={2} fill={CHERI.iris} />
          <Path d="M46 48.5 L56 50M64 50 L74 48.5" {...stroke} />
        </G>
      )
    case "sleepy":
      return (
        <G>
          <Ellipse cx={51} cy={51.5} rx={3.2} ry={2.2} fill={CHERI.iris} />
          <Ellipse cx={69} cy={51.5} rx={3.2} ry={2.2} fill={CHERI.iris} />
          <Path d="M46 49.5 Q51 48.5 56 49.5M64 49.5 Q69 48.5 74 49.5" {...stroke} />
        </G>
      )
    case "wink": {
      const ry = motion.blink.interpolate({ inputRange: [0, 1], outputRange: [0.4, 4.4] })
      return (
        <G>
          <OpenEye x={51} dx={0} dy={0} ry={ry} shine={motion.blink} />
          <Path d="M64 49.5 Q69 53 74 49.5 L76 48" {...stroke} />
        </G>
      )
    }
    default: {
      const ry = motion.blink.interpolate({ inputRange: [0, 1], outputRange: [0.4, 4.4] })
      return (
        <G>
          <OpenEye x={51} dx={motion.dx} dy={motion.dy} ry={ry} shine={motion.blink} />
          <OpenEye x={69} dx={motion.dx} dy={motion.dy} ry={ry} shine={motion.blink} />
        </G>
      )
    }
  }
}

export type BrowKind = "normal" | "raised" | "worried" | "angry"

const BROWS: Record<BrowKind, string> = {
  normal: "M46.5 42.5 Q50.5 39.5 55 41M65 41 Q69.5 39.5 73.5 42.5",
  raised: "M46.5 42.5 Q50.5 39.5 55 41M65 39.5 Q69.5 37.5 73.5 40.5",
  worried: "M47 41.5 Q51 41.5 55 39M65 39 Q69 41.5 73 41.5",
  angry: "M47 40 Q51 40.5 55.5 43M64.5 43 Q69 40.5 73 40",
}

export function Brows({ kind }: { kind: BrowKind }) {
  return <Path d={BROWS[kind]} stroke={CHERI.line} strokeWidth={1.4} fill="none" strokeLinecap="round" />
}

export function Mouth({ kind, yawn }: { kind: MouthKind; yawn: Num }) {
  const line = { stroke: CHERI.lips, strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const }
  switch (kind) {
    case "open":
      return <Path d="M55 60 Q60 66.5 65 60 Z" fill={CHERI.lips} />
    case "yawn":
      return <AnimatedEllipse cx={60} cy={62.5} rx={2.8} ry={yawn} fill={CHERI.headset} />
    case "cat":
      return <Path d="M55.5 61 Q57.75 63.8 60 61 Q62.25 63.8 64.5 61" {...line} />
    case "o":
      return <Ellipse cx={60} cy={62} rx={2} ry={2.6} fill={CHERI.headset} />
    case "pout":
      return <Path d="M57.5 63 Q60 60.6 62.5 63" {...line} strokeWidth={2.2} />
    case "wavy":
      return <Path d="M55.5 62 Q57.5 60.5 59.5 62 Q61.5 63.5 63.5 62 Q64.5 61.2 65 61" {...line} />
    case "frown":
      return <Path d="M56 63.5 Q60 59.8 64 63.5" {...line} />
    case "flat":
      return <Path d="M57 62 L63 62" {...line} stroke={CHERI.headset} strokeWidth={1.6} />
    case "side":
      return <Path d="M57.5 62 Q60.5 60.8 63.5 61.4" {...line} strokeWidth={2} />
    default:
      return (
        <G>
          <Path d="M55.5 61 Q60 58.8 64.5 61 Q60 65 55.5 61 Z" fill={CHERI.lips} />
          <Ellipse cx={61.5} cy={62.4} rx={1.5} ry={0.7} fill="#fff" opacity={0.8} />
        </G>
      )
  }
}

export function Blush({ kind }: { kind: Face["blush"] }) {
  const strong = kind === "strong"
  const fill = strong ? CHERI.blushStrong : CHERI.blush
  const opacity = kind === "faint" ? 0.3 : strong ? 1 : 0.8
  const rx = strong ? 4 : 3.2
  return (
    <G opacity={opacity}>
      <Ellipse cx={46.5} cy={57} rx={rx} ry={strong ? 2 : 1.6} fill={fill} />
      <Ellipse cx={73.5} cy={57} rx={rx} ry={strong ? 2 : 1.6} fill={fill} />
    </G>
  )
}
