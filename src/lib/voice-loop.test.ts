import test from "node:test"
import assert from "node:assert/strict"
import { voiceReducer, VOICE_OFF, latestAssistant, newReplyId, MAX_SILENT_ROUNDS, type VoiceEvent, type VoiceState } from "./voice-loop.ts"

const run = (events: VoiceEvent[], from: VoiceState = VOICE_OFF) => events.reduce(voiceReducer, from)

test("full round: listen, hear, wait, speak, listen again", () => {
  assert.deepEqual(run([{ type: "start" }]), { phase: "listening", silences: 0 })
  assert.equal(run([{ type: "start" }, { type: "heard", text: "hello" }]).phase, "thinking")
  assert.equal(run([{ type: "start" }, { type: "heard", text: "hi" }, { type: "replyReady", hasText: true }]).phase, "speaking")
  assert.equal(run([{ type: "start" }, { type: "heard", text: "hi" }, { type: "replyReady", hasText: true }, { type: "spoken" }]).phase, "listening")
})

test("a reply with nothing to read goes straight back to listening", () => {
  assert.equal(run([{ type: "start" }, { type: "heard", text: "hi" }, { type: "replyReady", hasText: false }]).phase, "listening")
})

test("voice mode gives up after several silent rounds", () => {
  const silent: VoiceEvent[] = Array.from({ length: MAX_SILENT_ROUNDS }, () => ({ type: "silence" }))
  assert.equal(run([{ type: "start" }, ...silent]).phase, "off")
  assert.equal(run([{ type: "start" }, ...silent.slice(1)]).phase, "listening")
  assert.equal(run([{ type: "start" }, { type: "heard", text: "   " }]).silences, 1)
})

test("stop and fail always end it; stray events are ignored", () => {
  assert.equal(run([{ type: "start" }, { type: "heard", text: "x" }, { type: "stop" }]).phase, "off")
  assert.equal(run([{ type: "start" }, { type: "fail" }]).phase, "off")
  assert.equal(run([{ type: "spoken" }]).phase, "off")
  assert.equal(run([{ type: "start" }, { type: "replyReady", hasText: true }]).phase, "listening")
  assert.equal(run([{ type: "start" }, { type: "start" }]).silences, 0)
})

test("only a new assistant message is read aloud", () => {
  const msgs = [
    { id: "u1", role: "user", time: { created: 1 } },
    { id: "a1", role: "assistant", time: { created: 2 } },
    { id: "u2", role: "user", time: { created: 3 } },
  ]
  assert.equal(latestAssistant(msgs)?.id, "a1")
  assert.equal(newReplyId(msgs, "a1"), null)
  assert.equal(newReplyId([...msgs, { id: "a2", role: "assistant", time: { created: 4 } }], "a1"), "a2")
  assert.equal(newReplyId([], null), null)
})
