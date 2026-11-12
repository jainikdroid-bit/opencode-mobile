// First-run setup guide: what it says and when it appears. Pure (no React/Expo imports) so it is
// unit-tested with plain `node --test`.

export const WINDOWS_COMMAND =
  "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.ps1)))"
export const UNIX_COMMAND =
  "curl -fsSL https://raw.githubusercontent.com/jainikdroid-bit/opencode-mobile/main/tools/opencode-connect.sh | sh"
export const TAILSCALE_STORE_URL = "https://play.google.com/store/apps/details?id=com.tailscale.ipn"
export const GUIDE_DOC_URL = "https://github.com/jainikdroid-bit/opencode-mobile/blob/main/docs/INSTALL.md"

export const GUIDE_DONE_KEY = "oc_guide_done"
export const GUIDE_STEPS = ["computer", "tailscale", "scan"] as const
export type GuideStep = (typeof GUIDE_STEPS)[number]
export type GuideOs = "windows" | "unix"

export function commandFor(os: GuideOs): string {
  return os === "windows" ? WINDOWS_COMMAND : UNIX_COMMAND
}

export function clampStep(index: number): number {
  return Math.min(GUIDE_STEPS.length - 1, Math.max(0, Math.trunc(index) || 0))
}

export function isLastStep(index: number): boolean {
  return clampStep(index) === GUIDE_STEPS.length - 1
}

/**
 * The guide opens by itself exactly once, for someone who has no server yet and has not skipped or finished it.
 * `loaded` is false until the stored flag has been read, so it never flashes up for returning users.
 */
export function shouldAutoShowGuide(input: { loaded: boolean; done: boolean; hasConnection: boolean }): boolean {
  return input.loaded && !input.done && !input.hasConnection
}
