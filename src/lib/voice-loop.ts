// Live voice conversation: listen -> send -> wait for the reply -> read it aloud -> listen again.
// The state machine is pure so the flow (and its give-up rules) can be tested without a phone.

export type VoicePhase = "off" | "listening" | "thinking" | "speaking"

export interface VoiceState {
  phase: VoicePhase
  /** consecutive listening rounds in which nothing was heard */
  silences: number
}

export type VoiceEvent =
  | { type: "start" }
  | { type: "heard"; text: string } // recognition finished with text
  | { type: "silence" } // recognition finished with nothing, or no-speech
  | { type: "replyReady"; hasText: boolean } // the assistant finished answering
  | { type: "spoken" } // reading aloud finished (or was skipped)
  | { type: "stop" }
  | { type: "fail" }

export const MAX_SILENT_ROUNDS = 3
export const VOICE_OFF: VoiceState = { phase: "off", silences: 0 }

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case "start":
      return state.phase === "off" ? { phase: "listening", silences: 0 } : state
    case "stop":
    case "fail":
      return VOICE_OFF
    case "heard":
      if (state.phase !== "listening") return state
      return event.text.trim() ? { phase: "thinking", silences: 0 } : voiceReducer(state, { type: "silence" })
    case "silence": {
      if (state.phase !== "listening") return state
      const silences = state.silences + 1
      return silences >= MAX_SILENT_ROUNDS ? VOICE_OFF : { phase: "listening", silences }
    }
    case "replyReady":
      if (state.phase !== "thinking") return state
      return event.hasText ? { phase: "speaking", silences: 0 } : { phase: "listening", silences: 0 }
    case "spoken":
      return state.phase === "speaking" ? { phase: "listening", silences: 0 } : state
  }
}

interface MessageLike {
  id: string
  role: string
  time?: { created?: number }
}

/** The newest assistant message, or null. */
export function latestAssistant<T extends MessageLike>(messages: readonly T[]): T | null {
  let best: T | null = null
  for (const m of messages) {
    if (m.role !== "assistant") continue
    if (!best || (m.time?.created ?? 0) >= (best.time?.created ?? 0)) best = m
  }
  return best
}

/**
 * Text to read aloud once a turn is over: only an assistant message that was not there when the question was sent,
 * so an old answer is never repeated.
 */
export function newReplyId<T extends MessageLike>(messages: readonly T[], idBeforeSend: string | null): string | null {
  const last = latestAssistant(messages)
  return last && last.id !== idBeforeSend ? last.id : null
}
