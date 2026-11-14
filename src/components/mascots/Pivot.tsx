import type { ReactNode } from "react"
import { Animated } from "react-native"
import { G } from "react-native-svg"

const AnimatedG = Animated.createAnimatedComponent(G)

type Num = number | Animated.AnimatedInterpolation<number>

/**
 * Rotates its children about (x, y). An Animated `rotation` on a react-native-svg G loses its
 * originX/originY and spins about (0, 0), flinging the part off the canvas, so we move the pivot
 * to the origin, rotate there, and move back.
 */
export function Pivot({ x, y, rotation, shiftX = 0, children }: { x: number; y: number; rotation: Num; shiftX?: Num; children: ReactNode }) {
  return (
    <G transform={`translate(${x} ${y})`}>
      <AnimatedG rotation={rotation} x={shiftX}>
        <G transform={`translate(${-x} ${-y})`}>{children}</G>
      </AnimatedG>
    </G>
  )
}
