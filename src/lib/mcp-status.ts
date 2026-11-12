// Pure helpers for the MCP connectors list (no expo/react imports, node --test friendly).

export type McpState = "connected" | "disabled" | "failed" | "needs_auth" | "other"

export interface McpRow {
  name: string
  state: McpState
  error?: string
}

export function normalizeState(status: string): McpState {
  switch (status) {
    case "connected":
    case "disabled":
    case "failed":
      return status
    case "needs_auth":
    case "needs_client_registration":
      return "needs_auth"
    default:
      return "other"
  }
}

/** Server status map -> stable, name-sorted rows. */
export function toMcpRows(map: Record<string, { status: string; error?: string }> | null | undefined): McpRow[] {
  return Object.entries(map ?? {})
    .map(([name, v]) => ({ name, state: normalizeState(v?.status ?? ""), error: v?.error }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The switch is "on" when the connector is connected (or still trying and not disabled). */
export function isOn(state: McpState): boolean {
  return state === "connected" || state === "failed" || state === "needs_auth"
}
