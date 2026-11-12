// Turns what another app shared with us ("Share → OpenCode") into things the composer understands.
// Pure and platform-neutral: the share screen does the file reading.

export interface SharedFile {
  path: string
  mimeType?: string | null
  fileName?: string | null
  size?: number | string | null
  width?: number | null
  height?: number | null
}
export interface ShareInput {
  text?: string | null
  webUrl?: string | null
  files?: SharedFile[] | null
}
export interface SharePlan {
  text: string
  images: { uri: string; mime: string; filename: string; width?: number; height?: number }[]
  textFiles: { uri: string; filename: string }[]
  skipped: string[]
}

export const MAX_TEXT_FILE_BYTES = 200_000
const TEXT_EXT = /\.(txt|md|json|ya?ml|toml|ini|cfg|conf|log|csv|tsv|xml|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|sh|bash|ps1|sql|env|gradle|properties|swift|php|lua)$/i

const nameOf = (f: SharedFile) => f.fileName || f.path.split(/[\/]/).pop() || "file"
const asNumber = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v) || undefined)
export const isTextFile = (f: SharedFile) => (f.mimeType || "").startsWith("text/") || TEXT_EXT.test(nameOf(f)) || f.mimeType === "application/json"

export function planShare(input: ShareInput): SharePlan {
  const plan: SharePlan = { text: "", images: [], textFiles: [], skipped: [] }
  const text = input.text?.trim() ?? ""
  const link = input.webUrl?.trim() ?? ""
  // Android hands over the link separately even when the text already contains it.
  plan.text = [text, link && !text.includes(link) ? link : ""].filter(Boolean).join("\n")
  for (const f of input.files ?? []) {
    const filename = nameOf(f)
    const uri = f.path.startsWith("/") ? `file://${f.path}` : f.path
    if ((f.mimeType || "").startsWith("image/")) {
      plan.images.push({ uri, mime: f.mimeType as string, filename, width: asNumber(f.width), height: asNumber(f.height) })
    } else if (isTextFile(f)) {
      const size = asNumber(f.size)
      if (size !== undefined && size > MAX_TEXT_FILE_BYTES) plan.skipped.push(`${filename} (too large)`)
      else plan.textFiles.push({ uri, filename })
    } else {
      plan.skipped.push(`${filename} (unsupported type)`)
    }
  }
  return plan
}

/** Puts a text file into the message as a fenced block with its name. */
export function fenceFile(filename: string, content: string): string {
  const fence = content.includes("```") ? "~~~~" : "```"
  return `${filename}:\n${fence}\n${content.replace(/\s+$/, "")}\n${fence}`
}

export const hasShareContent = (plan: SharePlan) => !!plan.text || plan.images.length > 0 || plan.textFiles.length > 0
