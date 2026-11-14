import { useCallback, useEffect, useRef, useState } from "react"
import { Animated, Easing } from "react-native"
import { ANTIC_MS, TAP_WINDOW_MS, enterAntic, nextDelayMs, pickAntic, tapAntic, type Antic, type Mood } from "../../lib/cheri-antics"

/**
 * Runs Cheri's antics: a random one every few seconds (per mood), a scene when the mood turns
 * to success or error, and escalating reactions to taps. `calm` turns the spontaneous ones off
 * (tiny previews, the runner game) but still lets taps through.
 */
export function useAntics(mood: Mood, calm: boolean) {
  const [antic, setAntic] = useState<Antic | null>(null)
  const progress = useRef(new Animated.Value(0)).current
  const running = useRef<Animated.CompositeAnimation | null>(null)
  const last = useRef<Antic | null>(null)
  const taps = useRef({ count: 0, at: 0 })
  const previousMood = useRef(mood)

  const play = useCallback(
    (next: Antic) => {
      running.current?.stop()
      last.current = next
      setAntic(next)
      progress.setValue(0)
      const animation = Animated.timing(progress, { toValue: 1, duration: ANTIC_MS[next], easing: Easing.linear, useNativeDriver: false })
      running.current = animation
      animation.start(({ finished }) => {
        if (finished && running.current === animation) {
          running.current = null
          setAntic(null)
        }
      })
    },
    [progress],
  )

  useEffect(() => () => running.current?.stop(), [])

  useEffect(() => {
    const changed = previousMood.current !== mood
    const entering = enterAntic(previousMood.current, mood)
    previousMood.current = mood
    if (entering && !calm) {
      play(entering)
    } else if (changed && running.current) {
      // A new mood ends the old mood's scene (no confetti left falling once she is back to idle).
      running.current.stop()
      running.current = null
      setAntic(null)
    }
  }, [mood, calm, play])

  useEffect(() => {
    if (calm) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      const delay = nextDelayMs(mood, Math.random)
      if (delay === null) return
      timer = setTimeout(() => {
        const next = pickAntic(mood, Math.random, last.current)
        if (next && running.current === null) play(next)
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [mood, calm, play])

  const tap = useCallback(() => {
    const now = Date.now()
    const count = now - taps.current.at < TAP_WINDOW_MS ? taps.current.count + 1 : 1
    taps.current = { count, at: now }
    play(tapAntic(count))
  }, [play])

  return { antic, progress, tap }
}
