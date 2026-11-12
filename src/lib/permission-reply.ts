// Quick permissions: answer an agent's approval request from anywhere in the app or straight from a notification.
// Pure helpers (no React/Expo) so the rules are testable.

import type { PendingPermission } from "./permissions"

export type PermissionReply = "once" | "always" | "reject"

export const PERMISSION_CATEGORY_ID = "permission-request"
export const ACTION_ALLOW = "permission-allow"
export const ACTION_DENY = "permission-deny"

/** Which reply a notification button means. "Always" is deliberately not offered there: it is a standing rule. */
export function replyFromAction(actionIdentifier: string): PermissionReply | null {
  if (actionIdentifier === ACTION_ALLOW) return "once"
  if (actionIdentifier === ACTION_DENY) return "reject"
  return null
}

/** All pending requests across sessions, oldest session first, in arrival order inside a session. */
export function flattenPending(pending: Record<string, PendingPermission[]>): PendingPermission[] {
  return Object.values(pending).flat()
}

/**
 * What the global banner should show: the first request that is not already shown inside the open chat,
 * plus how many more wait behind it.
 */
export function bannerState(
  pending: Record<string, PendingPermission[]>,
  openSessionId: string | null,
): { current: PendingPermission; more: number } | null {
  const visible = flattenPending(pending).filter((p) => p.sessionID !== openSessionId)
  return visible.length ? { current: visible[0], more: visible.length - 1 } : null
}

/** Session id from a route like /session/ses_123 (or null elsewhere). */
export function sessionIdFromPath(pathname: string): string | null {
  const m = /^\/session\/([^/?#]+)/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : null
}

export function describePermission(p: Pick<PendingPermission, "permission" | "patterns">, max = 140): string {
  const text = [p.permission, p.patterns.join(", ")].filter(Boolean).join(": ")
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
