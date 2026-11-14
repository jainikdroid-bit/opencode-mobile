import { useEffect, useRef } from "react"
import { Animated, Easing } from "react-native"

/** Loops 0 -> 1 -> 0 (ping-pong) or 0 -> 1 (restart) forever while enabled. */
export function useLoop(duration: number, pingPong: boolean, enabled = true) {
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

/** Quick eyelid close/open every `every` ms: 1 = open, 0 = shut. */
export function useBlink(every: number, enabled = true) {
  const value = useRef(new Animated.Value(1)).current
  useEffect(() => {
    value.setValue(1)
    if (!enabled) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(every),
        Animated.timing(value, { toValue: 0, duration: 80, useNativeDriver: false }),
        Animated.timing(value, { toValue: 1, duration: 110, useNativeDriver: false }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [value, every, enabled])
  return value
}
