// Server-Sent Events framing for the bridge's /acp/<id>/events stream (see tools/acp-bridge.js). Unlike
// the plain opencode event stream (sse.ts), the sequence number ("id:") and the event name matter here.
// Pure, so the chunk-splitting rules can be tested without a socket.
import type { RpcMessage, StreamEvent } from "./protocol"

export class AcpFrameParser {
  private buffer = ""

  /** Feed one decoded chunk; returns the events that completed in it. A partial trailing event waits for the next chunk. */
  push(chunk: string): StreamEvent[] {
    this.buffer += chunk.replace(/\r\n/g, "\n")
    const out: StreamEvent[] = []
    let at: number
    while ((at = this.buffer.indexOf("\n\n")) >= 0) {
      const block = this.buffer.slice(0, at)
      this.buffer = this.buffer.slice(at + 2)
      const event = parseBlock(block)
      if (event) out.push(event)
    }
    return out
  }
}

function parseBlock(block: string): StreamEvent | null {
  let name = "message"
  let seq: number | undefined
  let data = ""
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue
    if (line.startsWith("event: ")) name = line.slice(7)
    else if (line.startsWith("id: ")) seq = Number(line.slice(4))
    else if (line.startsWith("data: ")) data += line.slice(6)
  }
  const validSeq = seq !== undefined && Number.isInteger(seq) ? seq : undefined
  if (name === "live") return { kind: "live" }
  if (name === "gap") return { kind: "gap" }
  let body: any
  try {
    body = data ? JSON.parse(data) : null
  } catch {
    return null
  }
  if (name === "exit") return { kind: "exit", code: typeof body?.code === "number" ? body.code : null, stderr: typeof body?.stderr === "string" ? body.stderr : "" }
  if (!body || typeof body !== "object" || validSeq === undefined) return null
  return { kind: name === "sent" ? "sent" : "out", seq: validSeq, msg: body as RpcMessage }
}
