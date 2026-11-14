// Moods every mascot can show. Screens pick one; the chosen character draws it its own way.
export type MascotState = "idle" | "thinking" | "working" | "writing" | "loading" | "success" | "error" | "offline"

export interface MascotProps {
  state?: MascotState
  size?: number
}
