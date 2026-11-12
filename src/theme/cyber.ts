// Design tokens: dark, minimal, with cyberpunk accents (neon cyan / magenta on blue-black).
// Layout components read these; older screens were recoloured with the same values.
export const cyber = {
  bg: "#07080c",
  surface: "#0d1018",
  surface2: "#141926",
  border: "#1c2333",
  borderGlow: "#12384a",
  text: "#e8ecf4",
  muted: "#8a93a8",
  cyan: "#22d3ee",
  cyanDim: "#0891b2",
  magenta: "#ff3df0",
  green: "#34f5a5",
  amber: "#ffb800",
  red: "#ff4d6d",
  mono: "monospace",
} as const

export type CyberColor = keyof typeof cyber
