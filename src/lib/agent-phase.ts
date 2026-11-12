// What is the agent doing right now? Derived from the newest assistant message's
// parts so the UI can say "thinking", "using <tool>" or "writing" instead of a
// generic spinner. Pure (no expo/react imports) so it runs under plain `node --test`.

export interface PhasePart {
  type: string
  text?: string
  tool?: string
  time?: { start?: number; end?: number }
  state?: { status?: string }
}

export type AgentPhase =
  | { kind: "thinking" }
  | { kind: "tool"; tool: string }
  | { kind: "writing" }
  | { kind: "working" }

// A streaming part has started but not ended. Servers that send no timing at all
// are treated as "open" so the newest reasoning/text part still reads as live.
function isOpen(part: PhasePart): boolean {
  if (!part.time) return true
  return !!part.time.start && !part.time.end
}

export function agentPhase(parts: readonly PhasePart[] | undefined | null): AgentPhase {
  if (!parts || parts.length === 0) return { kind: "working" }
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    switch (part.type) {
      case "tool": {
        const status = part.state?.status
        if (status === "running" || status === "pending") return { kind: "tool", tool: part.tool ?? "tool" }
        return { kind: "working" } // between steps: the result is in, the next move is not
      }
      case "reasoning":
        return isOpen(part) ? { kind: "thinking" } : { kind: "working" }
      case "text":
        return isOpen(part) ? { kind: "writing" } : { kind: "working" }
      case "step-start":
      case "step-finish":
        return { kind: "working" }
      default:
        continue // snapshots, patches, files: not informative
    }
  }
  return { kind: "working" }
}

export interface ReasoningSummary {
  text: string
  streaming: boolean
  /** Total time spent reasoning in finished parts, in ms (0 when unknown). */
  durationMs: number
}

export function reasoningSummary(parts: readonly PhasePart[]): ReasoningSummary {
  const reasoning = parts.filter((p) => p.type === "reasoning")
  const text = reasoning
    .map((p) => p.text ?? "")
    .filter(Boolean)
    .join("\n\n")
  const last = reasoning[reasoning.length - 1]
  const streaming = !!last && !!last.time && isOpen(last)
  let durationMs = 0
  for (const p of reasoning) {
    if (p.time?.start && p.time.end && p.time.end >= p.time.start) durationMs += p.time.end - p.time.start
  }
  return { text, streaming, durationMs }
}

/** 7000 -> "0:07", 65000 -> "1:05", 3723000 -> "1:02:03". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`
}

/** The last few lines of live reasoning, so a streaming block stays compact. */
export function tailLines(text: string, lines = 4, maxChars = 320): string {
  const tail = text.trimEnd().split("\n").slice(-lines).join("\n")
  return tail.length > maxChars ? `…${tail.slice(-maxChars)}` : tail
}
