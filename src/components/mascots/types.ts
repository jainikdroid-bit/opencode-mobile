import type { Mood } from "../../lib/cheri-antics"

// Moods every mascot can show. Screens pick one; the chosen character draws it its own way.
export type MascotState = Mood

export interface MascotProps {
  state?: MascotState
  size?: number
  /** Let the user poke the mascot (Cheri reacts; RIG ignores it). */
  interactive?: boolean
  /** No spontaneous antics: for tiny previews and the runner game. */
  calm?: boolean
}
