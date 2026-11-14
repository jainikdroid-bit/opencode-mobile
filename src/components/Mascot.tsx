import { memo } from "react"
import { useSettings } from "../stores/settings"
import { CheriMascot } from "./mascots/CheriMascot"
import { RigMascot } from "./mascots/RigMascot"
import type { MascotProps } from "./mascots/types"
import type { MascotKind } from "../lib/mascot-choice"

export type { MascotState } from "./mascots/types"

/** Draws one specific character, regardless of the user's choice (used by the Settings picker). */
export function MascotOf({ kind, ...props }: MascotProps & { kind: MascotKind }) {
  return kind === "rig" ? <RigMascot {...props} /> : <CheriMascot {...props} />
}

/** The app's mascot: whichever character the user picked in Settings (Cheri by default). */
function MascotImpl(props: MascotProps) {
  const kind = useSettings((s) => s.mascot)
  return <MascotOf kind={kind} {...props} />
}

export const Mascot = memo(MascotImpl)
