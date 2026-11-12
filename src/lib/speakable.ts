// Turns an assistant message's markdown into text that is pleasant to hear.
// Pure (no expo imports) so it is unit-testable with plain `node --test`.

const MAX_CHARS = 3500 // Android's TTS engines reject very long utterances

export interface SpeakablePart {
  type: string
  text?: string
}

/** Text parts only (no reasoning, no tool output), joined with blank lines. */
export function speakableText(parts: readonly SpeakablePart[]): string {
  const raw = parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text as string)
    .join("\n\n")
  return cleanForSpeech(raw)
}

export function cleanForSpeech(markdown: string): string {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code is unreadable aloud
    .replace(/`([^`]*)`/g, "$1") // inline code: keep the words
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links: keep the label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading marks
    .replace(/^\s*[-*+]\s+/gm, "") // bullets
    .replace(/^\s*\d+\.\s+/gm, "") // numbering
    .replace(/[*_~>|]/g, "") // emphasis, quotes, table bars
    .replace(/https?:\/\/\S+/g, " ") // bare URLs
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return cleaned.length > MAX_CHARS ? `${cleaned.slice(0, MAX_CHARS)}…` : cleaned
}
