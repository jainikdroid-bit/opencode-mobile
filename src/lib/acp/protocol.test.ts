import { test } from "node:test"
import assert from "node:assert/strict"
import {
  initialState, reduce, nextHandshakeStep, loginHint, permissionResponse, unsupportedRequestReply, promptRequest, type AcpState, type RpcMessage, type StreamEvent,
} from "./protocol.ts"
import { AcpFrameParser } from "./frames.ts"

let seq = 0
const out = (msg: RpcMessage): StreamEvent => ({ kind: "out", seq: ++seq, msg: { jsonrpc: "2.0", ...msg } })
const sent = (msg: RpcMessage): StreamEvent => ({ kind: "sent", seq: ++seq, msg: { jsonrpc: "2.0", ...msg } })
const update = (u: Record<string, unknown>) => out({ method: "session/update", params: { sessionId: "s1", update: u } })
const run = (events: StreamEvent[], from: AcpState = initialState) => events.reduce(reduce, from)

const handshake: StreamEvent[] = [
  sent({ id: 1, method: "initialize", params: { protocolVersion: 1 } }),
  out({ id: 1, result: { protocolVersion: 1, agentInfo: { name: "OpenCode", version: "1.2" }, agentCapabilities: { promptCapabilities: { image: true } }, authMethods: [] } }),
  sent({ id: 2, method: "session/new", params: { cwd: "/w", mcpServers: [] } }),
  out({ id: 2, result: { sessionId: "s1", configOptions: [{ id: "model", category: "model", currentValue: "m1", options: [{ value: "m1", name: "Model One" }] }] } }),
]

test("the handshake is driven by the stream: initialize, then session/new, then ready", () => {
  let state = run([{ kind: "live" }])
  assert.equal(nextHandshakeStep(state, "/w", "0.15.0")?.method, "initialize")
  state = run([handshake[0]], state)
  assert.equal(nextHandshakeStep(state, "/w", "0.15.0"), null, "waits for the answer")
  state = run([handshake[1]], state)
  assert.equal(state.agentName, "OpenCode")
  assert.equal(state.imagesAllowed, true)
  assert.deepEqual(nextHandshakeStep(state, "/w", "0.15.0"), { jsonrpc: "2.0", id: 2, method: "session/new", params: { cwd: "/w", mcpServers: [] } })
  state = run([handshake[2], handshake[3]], state)
  assert.equal(state.handshake, "done")
  assert.equal(state.sessionId, "s1")
  assert.equal(state.modelName, "Model One")
  assert.equal(nextHandshakeStep(state, "/w", "0.15.0"), null)
})

test("nothing is sent while the backlog is still being replayed", () => {
  assert.equal(nextHandshakeStep(initialState, "/w", "0.15.0"), null)
})

test("a prompt becomes a user bubble, the answer streams into one agent bubble, and the turn ends", () => {
  const state = run([
    ...handshake,
    sent(promptRequest(3, "s1", "Hello there")),
    update({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "thinking" } }),
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Hi" } }),
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: " there" } }),
  ])
  assert.equal(state.busy, true)
  assert.deepEqual(state.items.map((i) => i.type), ["user", "thought", "agent"])
  assert.equal((state.items[2] as any).text, "Hi there")
  const done = run([out({ id: 3, result: { stopReason: "end_turn" } })], state)
  assert.equal(done.busy, false)
  assert.equal(done.nextId, 4)
})

test("tool calls start, then change in place; the plan is one item that updates", () => {
  const state = run([
    ...handshake,
    update({ sessionUpdate: "tool_call", toolCallId: "t1", title: "Read package.json", kind: "read", status: "pending", locations: [{ path: "/w/package.json" }] }),
    update({ sessionUpdate: "tool_call_update", toolCallId: "t1", status: "completed", content: [{ type: "content", content: { type: "text", text: "{}" } }] }),
    update({ sessionUpdate: "tool_call", toolCallId: "t2", title: "Edit", kind: "edit", content: [{ type: "diff", path: "a.ts", oldText: "a", newText: "b" }] }),
    update({ sessionUpdate: "plan", entries: [{ content: "one", priority: "high", status: "pending" }] }),
    update({ sessionUpdate: "plan", entries: [{ content: "one", priority: "high", status: "completed" }] }),
  ])
  const tools = state.items.filter((i) => i.type === "tool") as any[]
  assert.equal(tools.length, 2)
  assert.equal(tools[0].call.status, "completed")
  assert.equal(tools[0].call.title, "Read package.json", "an update without a title keeps the old one")
  assert.deepEqual(tools[0].call.content, [{ kind: "text", text: "{}" }])
  assert.deepEqual(tools[1].call.content, [{ kind: "diff", path: "a.ts", oldText: "a", newText: "b" }])
  const plans = state.items.filter((i) => i.type === "plan") as any[]
  assert.equal(plans.length, 1)
  assert.equal(plans[0].entries[0].status, "completed")
})

test("a permission request waits for the phone; answering (or the turn ending) clears it", () => {
  const ask = out({ id: 77, method: "session/request_permission", params: { sessionId: "s1", toolCall: { toolCallId: "t9", title: "Run rm", kind: "execute" }, options: [{ optionId: "y", name: "Allow", kind: "allow_once" }, { optionId: "n", name: "Reject", kind: "reject_once" }] } })
  const state = run([...handshake, sent(promptRequest(3, "s1", "go")), ask])
  assert.equal(state.pendingPermissions.length, 1)
  assert.equal(state.pendingPermissions[0].title, "Run rm")
  assert.deepEqual(state.pendingPermissions[0].options.map((o) => o.kind), ["allow_once", "reject_once"])
  assert.ok(state.items.some((i) => i.type === "tool" && i.call.id === "t9"), "the tool shows up even before its own update")
  const answered = run([sent(permissionResponse(77, "y"))], state)
  assert.equal(answered.pendingPermissions.length, 0)
  const ended = run([out({ id: 3, result: { stopReason: "cancelled" } })], state)
  assert.equal(ended.pendingPermissions.length, 0)
  assert.deepEqual(permissionResponse(77, null).result, { outcome: { outcome: "cancelled" } })
})

test("requests the phone does not serve get an error reply at once", () => {
  assert.equal(unsupportedRequestReply({ id: 5, method: "fs/read_text_file", params: {} })?.error?.code, -32601)
  assert.equal(unsupportedRequestReply({ id: 6, method: "session/request_permission" }), null)
  assert.equal(unsupportedRequestReply({ method: "session/update" }), null, "notifications need no answer")
})

test("auth required: the first non-terminal method is used; terminal-only means log in on the computer", () => {
  const needed = (methods: unknown[]) => run([
    { kind: "live" },
    sent({ id: 1, method: "initialize" }),
    out({ id: 1, result: { authMethods: methods } }),
    sent({ id: 2, method: "session/new" }),
    out({ id: 2, error: { code: -32000, message: "Authentication required" } }),
  ])
  const agent = needed([{ id: "key", name: "API key" }])
  assert.equal(agent.handshake, "auth-required")
  assert.deepEqual(nextHandshakeStep(agent, "/w", "1")?.params, { methodId: "key" })
  const terminal = needed([{ id: "login", name: "Login with opencode", type: "terminal" }])
  assert.equal(nextHandshakeStep(terminal, "/w", "1"), null)
  assert.equal(loginHint(terminal), "Login with opencode")
})

test("a failed prompt is shown as an error notice; the exit of the agent ends everything", () => {
  const failed = run([...handshake, sent(promptRequest(3, "s1", "x")), out({ id: 3, error: { code: -32603, message: "model unavailable" } })])
  assert.equal(failed.busy, false)
  assert.deepEqual(failed.items.at(-1), { id: failed.items.at(-1)!.id, type: "notice", text: "model unavailable", tone: "error" })
  const exited = run([sent(promptRequest(4, "s1", "y")), { kind: "exit", code: 3, stderr: "boom" }], failed)
  assert.equal(exited.busy, false)
  assert.deepEqual(exited.exit, { code: 3, stderr: "boom" })
})

test("reading the same stream in one go or in two reconnects gives the same chat", () => {
  const all = [
    { kind: "live" } as StreamEvent,
    ...handshake,
    sent(promptRequest(3, "s1", "hello")),
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "A" } }),
    update({ sessionUpdate: "tool_call", toolCallId: "t1", title: "T", kind: "read" }),
  ]
  const whole = run(all)
  const half = run(all.slice(0, 4))
  const resumed = run(all.slice(4), half)
  assert.deepEqual(resumed.items, whole.items)
  assert.equal(resumed.lastSeq, whole.lastSeq)
})

test("event frames: ids, event names, split chunks, heartbeats", () => {
  const parser = new AcpFrameParser()
  const frame = 'id: 4\nevent: sent\ndata: {"jsonrpc":"2.0","id":1,"method":"initialize"}\n\n'
  assert.deepEqual(parser.push(frame.slice(0, 20)), [])
  const events = parser.push(frame.slice(20) + ': hb\n\nevent: live\ndata: {}\n\nid: 5\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n\n')
  assert.deepEqual(events.map((e) => e.kind), ["sent", "live", "out"])
  assert.equal((events[0] as any).seq, 4)
  assert.deepEqual(parser.push('event: exit\ndata: {"code":3,"signal":null,"stderr":"x"}\n\n'), [{ kind: "exit", code: 3, stderr: "x" }])
  assert.deepEqual(parser.push("id: 6\ndata: not json\n\n"), [])
})

test("each turn gets its own plan; within a turn the plan updates in place", () => {
  const plan = (status: "pending" | "completed") => update({ sessionUpdate: "plan", entries: [{ content: "step", priority: "high", status }] })
  const state = run([...handshake, sent(promptRequest(3, "s1", "one")), plan("pending"), plan("completed"), out({ id: 3, result: { stopReason: "end_turn" } }), sent(promptRequest(4, "s1", "two")), plan("pending")])
  assert.deepEqual(state.items.map((i) => i.type), ["user", "plan", "user", "plan"])
  assert.equal((state.items[1] as any).entries[0].status, "completed")
  assert.equal((state.items[3] as any).entries[0].status, "pending")
})

test("an agent that starts in a no-questions mode is switched to the safe one, with a notice; the person can still choose", () => {
  const claudeLike = [
    { kind: "live" } as StreamEvent,
    sent({ id: 1, method: "initialize" }),
    out({ id: 1, result: { protocolVersion: 1, agentInfo: { name: "Claude Agent", version: "0.107" }, agentCapabilities: { _meta: { claudeCode: {} }, promptCapabilities: { image: true } }, authMethods: [] } }),
    out({ method: "_auth/status_update", params: { authStatus: {} } }),
    sent({ id: 2, method: "session/new" }),
    out({ id: 2, result: { sessionId: "c1", modes: { currentModeId: "bypassPermissions", availableModes: [{ id: "default", name: "Manual", description: "Always ask" }, { id: "plan", name: "Plan" }, { id: "bypassPermissions", name: "Bypass permissions" }] } } }),
  ]
  const state = run(claudeLike)
  assert.equal(state.modeId, "bypassPermissions")
  assert.deepEqual(state.modes.map((m) => m.id), ["default", "plan", "bypassPermissions"])
  const notice = state.items.find((i) => i.type === "notice") as any
  assert.deepEqual([notice.text, notice.params], ["safeMode", { from: "Bypass permissions", to: "Manual" }])
  assert.deepEqual(nextHandshakeStep(state, "/w", "1")?.params, { sessionId: "c1", modeId: "default" })
  const switched = run([sent({ id: 3, method: "session/set_mode", params: { sessionId: "c1", modeId: "default" } }), out({ id: 3, result: {} }), update({ sessionUpdate: "current_mode_update", currentModeId: "default" })], state)
  assert.equal(switched.modeId, "default")
  assert.equal(nextHandshakeStep(switched, "/w", "1"), null, "switched once, not again")
  const again = run([sent({ id: 4, method: "session/set_mode", params: { sessionId: "c1", modeId: "plan" } })], switched)
  assert.equal(again.modeId, "plan")
  // an agent already in a safe mode is left alone
  const calm = run(claudeLike.slice(0, 5).concat(out({ id: 2, result: { sessionId: "c1", modes: { currentModeId: "default", availableModes: [{ id: "default", name: "Manual" }] } } })))
  assert.equal(nextHandshakeStep(calm, "/w", "1"), null)
  assert.ok(!calm.items.some((i) => i.type === "notice"))
})
