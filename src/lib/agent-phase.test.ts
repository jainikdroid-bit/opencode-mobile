import test from "node:test"
import assert from "node:assert/strict"
import { agentPhase, reasoningSummary, formatElapsed, tailLines } from "./agent-phase.ts"

test("live reasoning reads as thinking, finished reasoning as working", () => {
  assert.deepEqual(agentPhase([{ type: "reasoning", time: { start: 1 } }]), { kind: "thinking" })
  assert.deepEqual(agentPhase([{ type: "reasoning", time: { start: 1, end: 2 } }]), { kind: "working" })
})

test("a running tool names itself; a finished one means the agent is between steps", () => {
  assert.deepEqual(agentPhase([{ type: "tool", tool: "bash", state: { status: "running" } }]), { kind: "tool", tool: "bash" })
  assert.deepEqual(agentPhase([{ type: "tool", tool: "bash", state: { status: "pending" } }]), { kind: "tool", tool: "bash" })
  assert.deepEqual(agentPhase([{ type: "tool", tool: "bash", state: { status: "completed" } }]), { kind: "working" })
})

test("streaming text is writing; step boundaries and snapshots are skipped sensibly", () => {
  assert.deepEqual(agentPhase([{ type: "text", time: { start: 1 } }]), { kind: "writing" })
  assert.deepEqual(agentPhase([{ type: "text", time: { start: 1, end: 3 } }]), { kind: "working" })
  assert.deepEqual(agentPhase([{ type: "reasoning", time: { start: 1 } }, { type: "snapshot" }]), { kind: "thinking" })
  assert.deepEqual(agentPhase([{ type: "text", time: { start: 1 } }, { type: "step-finish" }]), { kind: "working" })
})

test("no parts or no timing: sensible defaults", () => {
  assert.deepEqual(agentPhase([]), { kind: "working" })
  assert.deepEqual(agentPhase(undefined), { kind: "working" })
  assert.deepEqual(agentPhase([{ type: "reasoning" }]), { kind: "thinking" })
})

test("reasoning summary joins text, detects streaming and sums finished time", () => {
  const s = reasoningSummary([
    { type: "text", text: "ignored" },
    { type: "reasoning", text: "first", time: { start: 1000, end: 4000 } },
    { type: "reasoning", text: "second", time: { start: 5000 } },
  ])
  assert.equal(s.text, "first\n\nsecond")
  assert.equal(s.streaming, true)
  assert.equal(s.durationMs, 3000)
  assert.equal(reasoningSummary([{ type: "reasoning", text: "x", time: { start: 1, end: 2 } }]).streaming, false)
  assert.equal(reasoningSummary([{ type: "reasoning", text: "x" }]).streaming, false) // no timing: not claimed live
})

test("elapsed time formatting", () => {
  assert.equal(formatElapsed(0), "0:00")
  assert.equal(formatElapsed(7000), "0:07")
  assert.equal(formatElapsed(65000), "1:05")
  assert.equal(formatElapsed(3723000), "1:02:03")
  assert.equal(formatElapsed(-5), "0:00")
})

test("tail keeps the last lines and caps length", () => {
  assert.equal(tailLines("a\nb\nc\nd\ne\nf", 3), "d\ne\nf")
  const long = tailLines("x".repeat(1000), 4, 50)
  assert.ok(long.startsWith("…") && long.length === 51)
})
