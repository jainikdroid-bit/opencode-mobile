import { Animated } from "react-native"
import { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from "react-native-svg"
import type { Antic } from "../../lib/cheri-antics"
import { CHERI } from "./cheriFace"

// The props and effects of each antic. `p` runs 0 -> 1 over the antic's duration.
// HeadScene draws on the head grid (moves with her head); Scene draws on the 120x120 canvas.

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedRect = Animated.createAnimatedComponent(Rect)

type P = Animated.Value

const bell = (p: P, edge = 0.12) => p.interpolate({ inputRange: [0, edge, 1 - edge, 1], outputRange: [0, 1, 1, 0] })
const window_ = (p: P, from: number, to: number) =>
  p.interpolate({ inputRange: [0, from, Math.min(1, from + 0.02), Math.max(from + 0.02, to - 0.02), to, 1], outputRange: [0, 0, 1, 1, 0, 0], extrapolate: "clamp" })

function heart(x: number, y: number, s: number) {
  return `M${x} ${y + 3 * s} C${x - 4.5 * s} ${y} ${x - 2.5 * s} ${y - 3.2 * s} ${x} ${y - 1.2 * s} C${x + 2.5 * s} ${y - 3.2 * s} ${x + 4.5 * s} ${y} ${x} ${y + 3 * s} Z`
}

function star(x: number, y: number, r: number) {
  const k = r * 0.3
  return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`
}

const CONFETTI = [
  [22, -2, "#E24B4A"],
  [34, 6, "#EF9F27"],
  [46, -6, "#22d3ee"],
  [58, 2, "#1D9E75"],
  [70, -4, "#D4537E"],
  [82, 4, "#7F77DD"],
  [94, -2, "#EF9F27"],
  [28, 14, "#22d3ee"],
  [52, 12, "#E24B4A"],
  [76, 16, "#1D9E75"],
  [100, 10, "#D4537E"],
  [16, 8, "#7F77DD"],
] as const

/** Effects that ride on her head (bubble gum, tears, sweat, snot bubble). */
export function HeadScene({ antic, p }: { antic: Antic | null; p: P }) {
  switch (antic) {
    case "yawn":
      return (
        <AnimatedG opacity={p.interpolate({ inputRange: [0, 0.5, 0.7, 1], outputRange: [0, 0, 1, 0.8] })}>
          <Ellipse cx={76} cy={52} rx={1.2} ry={1.8} fill={CHERI.tear} />
        </AnimatedG>
      )
    case "bubblegum":
      return (
        <G>
          <AnimatedCircle
            cx={60}
            cy={65}
            r={p.interpolate({ inputRange: [0, 0.15, 0.72, 0.76, 0.77, 1], outputRange: [0, 1.5, 7, 7.6, 0, 0] })}
            fill={CHERI.jacket}
            stroke={CHERI.jacketEdge}
            strokeWidth={0.8}
            opacity={0.92}
          />
          <AnimatedG opacity={window_(p, 0.76, 0.95)} stroke={CHERI.jacketEdge} strokeWidth={1.2} strokeLinecap="round">
            <Line x1={52} y1={60} x2={49} y2={57} />
            <Line x1={68} y1={60} x2={71} y2={57} />
            <Line x1={51} y1={68} x2={47} y2={69} />
            <Line x1={69} y1={68} x2={73} y2={69} />
          </AnimatedG>
        </G>
      )
    case "sweat":
    case "storm":
      return (
        <AnimatedG y={p.interpolate({ inputRange: [0, 1], outputRange: [0, 9] })} opacity={bell(p, 0.15)}>
          <Path d="M78 35 Q75.3 39.5 78 41 Q80.7 39.5 78 35 Z" fill={CHERI.tear} stroke={CHERI.tearEdge} strokeWidth={0.6} />
        </AnimatedG>
      )
    case "sleepy":
      return (
        <AnimatedCircle
          cx={63.5}
          cy={57.5}
          r={p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 4, 1.5, 4.5, 1] })}
          fill="#B5D4F4"
          stroke={CHERI.tear}
          strokeWidth={0.6}
          opacity={0.85}
        />
      )
    default:
      return null
  }
}

/** Props and effects around her: hearts, notes, coffee, clouds, confetti, stars. */
export function Scene({ antic, p }: { antic: Antic | null; p: P }) {
  switch (antic) {
    case "wink":
    case "celebrate":
      return (
        <G>
          {antic === "celebrate"
            ? CONFETTI.map(([x, y0, color], i) => (
                <AnimatedRect
                  key={i}
                  x={x}
                  y={p.interpolate({ inputRange: [0, 1], outputRange: [y0, y0 + 72 + (i % 3) * 8] })}
                  width={3.5}
                  height={i % 2 ? 2 : 4.5}
                  rx={0.8}
                  fill={color}
                  opacity={p.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] })}
                />
              ))
            : null}
          <AnimatedG y={p.interpolate({ inputRange: [0, 1], outputRange: [0, -14] })} opacity={bell(p)}>
            <Path d={heart(92, 40, 1.6)} fill={CHERI.lips} />
          </AnimatedG>
        </G>
      )
    case "coffee":
      return (
        <AnimatedG opacity={bell(p, 0.1)}>
          <Rect x={86} y={90} width={13} height={13} rx={2.5} fill="#fff" stroke={CHERI.headset} strokeWidth={1.5} />
          <Rect x={87.5} y={91.5} width={10} height={2.2} rx={1} fill="#854F0B" />
          <Path d="M99 93 Q104.5 96.5 99 100" stroke={CHERI.headset} strokeWidth={1.5} fill="none" />
          {[89, 92.5, 96].map((x, i) => (
            <AnimatedCircle
              key={x}
              cx={x}
              cy={p.interpolate({ inputRange: [0, 1], outputRange: [87 - i, 74 - i] })}
              r={1.6}
              fill={CHERI.grey}
              opacity={p.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.5, 0.3, 0] })}
            />
          ))}
        </AnimatedG>
      )
    case "nya":
      return (
        <AnimatedG opacity={bell(p)}>
          <Rect x={80} y={14} width={34} height={16} rx={8} fill="#fff" stroke={CHERI.jacketEdge} strokeWidth={1.2} />
          <Path d="M86 29.4 L82 36 L92 29.4 Z" fill="#fff" stroke={CHERI.jacketEdge} strokeWidth={1.2} strokeLinejoin="round" />
          <Rect x={85} y={28} width={8} height={2} fill="#fff" />
          <SvgText x={97} y={25.5} fontSize={9.5} fontWeight="bold" fill={CHERI.headset} textAnchor="middle">
            nya~
          </SvgText>
        </AnimatedG>
      )
    case "sneeze":
      return (
        <G>
          <AnimatedG opacity={window_(p, 0.05, 0.5)}>
            <SvgText x={94} y={34} fontSize={16} fontWeight="bold" fill={CHERI.amber}>
              !
            </SvgText>
          </AnimatedG>
          <AnimatedG opacity={p.interpolate({ inputRange: [0, 0.5, 0.55, 0.8, 1], outputRange: [0, 0, 1, 0.8, 0] })}>
            <Circle cx={74} cy={72} r={3.2} fill="#fff" stroke={CHERI.grey} strokeWidth={0.8} />
            <Circle cx={80} cy={69} r={4.2} fill="#fff" stroke={CHERI.grey} strokeWidth={0.8} />
            <Circle cx={79} cy={76} r={2.6} fill="#fff" stroke={CHERI.grey} strokeWidth={0.8} />
          </AnimatedG>
        </G>
      )
    case "music":
    case "giggle":
      return (
        <AnimatedG y={p.interpolate({ inputRange: [0, 1], outputRange: [0, -18] })} opacity={bell(p)}>
          <SvgText x={90} y={40} fontSize={13} fill={CHERI.headset}>
            ♪
          </SvgText>
          {antic === "music" ? (
            <SvgText x={100} y={30} fontSize={11} fill={CHERI.iris}>
              ♫
            </SvgText>
          ) : null}
        </AnimatedG>
      )
    case "glitch":
      return (
        <G>
          <AnimatedRect x={28} y={42} width={64} height={3} fill={CHERI.cyan} opacity={window_(p, 0.08, 0.32)} />
          <AnimatedRect x={34} y={57} width={52} height={2.5} fill={CHERI.magenta} opacity={window_(p, 0.26, 0.52)} />
          <AnimatedRect x={30} y={70} width={60} height={2} fill={CHERI.cyan} opacity={window_(p, 0.46, 0.68)} />
        </G>
      )
    case "sleepy":
      return (
        <G>
          {(
            [
              [86, 36, 8, 0],
              [93, 27, 10, 0.25],
              [101, 17, 12, 0.5],
            ] as const
          ).map(([x, y, size, at]) => (
            <AnimatedG key={x} opacity={p.interpolate({ inputRange: [0, at, at + 0.08, at + 0.4, 1], outputRange: [0, 0, 1, 0, 0], extrapolate: "clamp" })}>
              <SvgText x={x} y={y} fontSize={size} fontWeight="bold" fill="#7F77DD">
                z
              </SvgText>
            </AnimatedG>
          ))}
        </G>
      )
    case "storm":
      return (
        <AnimatedG opacity={bell(p, 0.1)}>
          <AnimatedG y={p.interpolate({ inputRange: [0, 0.25, 0.2501, 0.5, 0.5001, 0.75, 0.7501, 1], outputRange: [0, 7, 0, 7, 0, 7, 0, 7] })}>
            {[93, 99, 105].map((x) => (
              <Line key={x} x1={x} y1={24} x2={x - 1.5} y2={29} stroke={CHERI.tearEdge} strokeWidth={1.4} strokeLinecap="round" />
            ))}
          </AnimatedG>
          <AnimatedG opacity={window_(p, 0.5, 0.64)}>
            <Path d="M101 21 L96.5 29 L100.5 29 L97 37" stroke={CHERI.amber} strokeWidth={2} fill="none" strokeLinejoin="round" />
          </AnimatedG>
          <Ellipse cx={92} cy={18} rx={7} ry={5} fill={CHERI.grey} />
          <Ellipse cx={99} cy={14.5} rx={8} ry={6} fill="#B4B2A9" />
          <Ellipse cx={105.5} cy={18} rx={6} ry={4.5} fill={CHERI.grey} />
        </AnimatedG>
      )
    case "hearts":
      return (
        <G>
          {(
            [
              [60, 34, 0, 2],
              [46, 38, 0.15, 1.4],
              [76, 37, 0.3, 1.6],
            ] as const
          ).map(([x, y, at, s]) => (
            <AnimatedG
              key={x}
              y={p.interpolate({ inputRange: [0, 1], outputRange: [0, -22] })}
              opacity={p.interpolate({ inputRange: [0, at, at + 0.12, 0.85, 1], outputRange: [0, 0, 1, 1, 0], extrapolate: "clamp" })}
            >
              <Path d={heart(x, y, s)} fill={x === 60 ? CHERI.red : CHERI.lips} />
            </AnimatedG>
          ))}
        </G>
      )
    case "pout":
      return (
        <AnimatedG opacity={p.interpolate({ inputRange: [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1], outputRange: [0, 1, 0.6, 1, 0.6, 1, 0] })}>
          <Path
            d="M83 26 Q86 29 83 32M91 26 Q88 29 91 32M84 25 Q87 28 90 25M84 33 Q87 30 90 33"
            stroke={CHERI.red}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          />
        </AnimatedG>
      )
    case "dizzy":
      return (
        <AnimatedG rotation={p.interpolate({ inputRange: [0, 1], outputRange: [0, 720] })} originX={60} originY={14}>
          <Path d={star(60, 2, 3.5)} fill={CHERI.amber} />
          <Path d={star(72, 20, 3)} fill={CHERI.cyan} />
          <Path d={star(48, 20, 3)} fill={CHERI.lips} />
        </AnimatedG>
      )
    default:
      return null
  }
}

/** Head tilt in degrees (music, giggle) and sideways jitter (glitch) for the antic. */
export function headMotion(antic: Antic | null, p: P) {
  if (antic === "music") {
    return {
      bob: p.interpolate({ inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], outputRange: [0, 4, 0, -4, 0, 4, 0, -4, 0] }),
      jitter: 0,
    }
  }
  if (antic === "giggle") {
    return { bob: p.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, 3, -3, 3, -3, 0] }), jitter: 0 }
  }
  if (antic === "glitch") {
    return { bob: 0, jitter: p.interpolate({ inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1], outputRange: [0, 2.5, -2, 1.5, -2.5, 1, 0, 0] }) }
  }
  return { bob: 0, jitter: 0 }
}

/** Left-ear rotation (earTwitch) and both ears' hop (sneeze), on the head grid. */
export function earMotion(antic: Antic | null, p: P) {
  const twitch =
    antic === "earTwitch" || antic === "nya"
      ? p.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -16, 6, -12, 4, 0] })
      : 0
  const hop = antic === "sneeze" ? p.interpolate({ inputRange: [0, 0.5, 0.56, 0.68, 1], outputRange: [0, 0, -3.5, 0, 0] }) : 0
  return { twitch, hop }
}

/** Iris glance for lookAround. */
export function glance(antic: Antic | null, p: P) {
  return antic === "lookAround" ? p.interpolate({ inputRange: [0, 0.2, 0.45, 0.7, 1], outputRange: [0, -2.2, -2.2, 2.2, 0] }) : null
}

/** Yawn mouth height. */
export function yawnHeight(p: P) {
  return p.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [1, 4.6, 4.6, 1] })
}
