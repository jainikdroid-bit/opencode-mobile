// Agent Client Protocol, the phone side (https://agentclientprotocol.com): turns the stream of JSON-RPC
// messages that the computer's bridge (tools/acp-bridge.js) relays into a chat, and builds the messages the
// phone sends back. Pure (no React Native imports): runs under `node --test`.
//
// The chat is a function of the stream: the bridge echoes what the phone sent ("sent" events) and replays the
// agent's messages, so reopening the app on a running agent rebuilds the same chat by reading from the start.

export const PROTOCOL_VERSION = 1
const AUTH_REQUIRED = -32000
const METHOD_NOT_FOUND = -32601

// ----- messages -----

export type RpcId = number | string
export interface RpcMessage {
  jsonrpc?: "2.0"
  id?: RpcId | null
  method?: string
  params?: any
  result?: any
  error?: { code?: number; message?: string; data?: unknown }
}

/** What arrives from the bridge: an agent message, an echo of what the phone sent, or a marker. */
export type StreamEvent =
  | { kind: "out" | "sent"; seq: number; msg: RpcMessage }
  | { kind: "live"; seq?: number }
  | { kind: "gap"; seq?: number }
  | { kind: "exit"; seq?: number; code: number | null; stderr: string }

// ----- chat model -----

export type ToolKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "switch_mode" | "other"
export type ToolStatus = "pending" | "in_progress" | "completed" | "failed"
export type ToolContent =
  | { kind: "text"; text: string }
  | { kind: "diff"; path: string; oldText: string | null; newText: string }
  | { kind: "terminal"; terminalId: string }

export interface ToolCall {
  id: string
  title: string
  kind: ToolKind
  status: ToolStatus
  content: ToolContent[]
  locations: { path: string; line?: number }[]
}

export interface PlanEntry {
  content: string
  priority: string
  status: "pending" | "in_progress" | "completed"
}

export interface PermissionOption {
  optionId: string
  name: string
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always"
}

export interface PermissionRequest {
  requestId: RpcId
  toolCallId: string
  title: string
  options: PermissionOption[]
}

export type ChatItem =
  | { id: string; type: "user"; text: string; images: number }
  | { id: string; type: "agent"; text: string }
  | { id: string; type: "thought"; text: string }
  | { id: string; type: "tool"; call: ToolCall }
  | { id: string; type: "plan"; entries: PlanEntry[] }
  | { id: string; type: "notice"; text: string; tone: "info" | "error"; params?: Record<string, string> }

export interface AgentMode {
  id: string
  name: string
  description: string
}

export type Handshake = "none" | "initializing" | "initialized" | "creating" | "auth-required" | "authenticating" | "done" | "failed"

export interface AcpState {
  /** True until the bridge says the backlog is over: no handshake before that (the chat may already exist). */
  replaying: boolean
  handshake: Handshake
  agentName: string
  agentVersion: string
  imagesAllowed: boolean
  authMethods: { id: string; name: string; type: string }[]
  sessionId: string | null
  modelName: string
  items: ChatItem[]
  busy: boolean
  pendingPermissions: PermissionRequest[]
  commands: { name: string; description: string }[]
  modes: AgentMode[]
  modeId: string
  /** The agent started in a mode that runs tools without asking: switch it to this safer one (once). */
  safeSwitch: { toId: string } | null
  usage: { used: number; size: number } | null
  error: string | null
  exit: { code: number | null; stderr: string } | null
  lastSeq: number
  /** Ids of the phone's own requests that wait for an answer, with the method they asked. */
  requests: Record<string, string>
  nextId: number
  itemCounter: number
}

export const initialState: AcpState = {
  replaying: true,
  handshake: "none",
  agentName: "",
  agentVersion: "",
  imagesAllowed: false,
  authMethods: [],
  sessionId: null,
  modelName: "",
  items: [],
  busy: false,
  pendingPermissions: [],
  commands: [],
  modes: [],
  modeId: "",
  safeSwitch: null,
  usage: null,
  error: null,
  exit: null,
  lastSeq: 0,
  requests: {},
  nextId: 1,
  itemCounter: 0,
}

// ----- helpers -----

const isObject = (x: unknown): x is Record<string, any> => !!x && typeof x === "object" && !Array.isArray(x)
const str = (x: unknown): string => (typeof x === "string" ? x : "")

/** Text of one content block, for the chat. */
export function blockText(block: unknown): string {
  if (!isObject(block)) return ""
  if (block.type === "text") return str(block.text)
  if (block.type === "resource_link") return `[${str(block.name) || str(block.uri)}](${str(block.uri)})`
  if (block.type === "resource" && isObject(block.resource)) return str(block.resource.text) || str(block.resource.uri)
  if (block.type === "image") return "🖼"
  return ""
}

function toolContent(raw: unknown): ToolContent[] {
  if (!Array.isArray(raw)) return []
  const out: ToolContent[] = []
  for (const c of raw) {
    if (!isObject(c)) continue
    if (c.type === "content") { const text = blockText(c.content); if (text) out.push({ kind: "text", text }) }
    else if (c.type === "diff") out.push({ kind: "diff", path: str(c.path), oldText: typeof c.oldText === "string" ? c.oldText : null, newText: str(c.newText) })
    else if (c.type === "terminal") out.push({ kind: "terminal", terminalId: str(c.terminalId) })
  }
  return out
}

function locations(raw: unknown): { path: string; line?: number }[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((l) => isObject(l) && typeof l.path === "string").map((l) => ({ path: l.path as string, ...(Number.isInteger(l.line) ? { line: l.line as number } : {}) }))
}

const KINDS = new Set(["read", "edit", "delete", "move", "search", "execute", "think", "fetch", "switch_mode", "other"])
const STATUSES = new Set(["pending", "in_progress", "completed", "failed"])
const kindOf = (x: unknown, fallback: ToolKind): ToolKind => (typeof x === "string" && KINDS.has(x) ? (x as ToolKind) : fallback)
const statusOf = (x: unknown, fallback: ToolStatus): ToolStatus => (typeof x === "string" && STATUSES.has(x) ? (x as ToolStatus) : fallback)

function withItem(state: AcpState, make: (id: string) => ChatItem): AcpState {
  const id = `i${state.itemCounter + 1}`
  return { ...state, itemCounter: state.itemCounter + 1, items: [...state.items, make(id)] }
}

/** Text streams in pieces: it extends the last item when that is the same kind, else it starts a new one. */
function appendText(state: AcpState, type: "agent" | "thought", text: string): AcpState {
  if (!text) return state
  const last = state.items.at(-1)
  if (last && last.type === type) return { ...state, items: [...state.items.slice(0, -1), { ...last, text: last.text + text }] }
  return withItem(state, (id) => ({ id, type, text }))
}

function upsertTool(state: AcpState, update: Record<string, any>, isNew: boolean): AcpState {
  const callId = str(update.toolCallId)
  if (!callId) return state
  const at = state.items.findIndex((i) => i.type === "tool" && i.call.id === callId)
  if (at < 0) {
    const call: ToolCall = {
      id: callId,
      title: str(update.title) || str(update.name) || "…",
      kind: kindOf(update.kind, "other"),
      status: statusOf(update.status, isNew ? "pending" : "in_progress"),
      content: toolContent(update.content),
      locations: locations(update.locations),
    }
    return withItem(state, (id) => ({ id, type: "tool", call }))
  }
  const item = state.items[at] as Extract<ChatItem, { type: "tool" }>
  const call: ToolCall = {
    ...item.call,
    title: str(update.title) || item.call.title,
    kind: kindOf(update.kind, item.call.kind),
    status: statusOf(update.status, item.call.status),
    content: Array.isArray(update.content) ? toolContent(update.content) : item.call.content,
    locations: Array.isArray(update.locations) ? locations(update.locations) : item.call.locations,
  }
  return { ...state, items: state.items.map((i, n) => (n === at ? { ...item, call } : i)) }
}

function notice(state: AcpState, text: string, tone: "info" | "error", params?: Record<string, string>): AcpState {
  return withItem(state, (id) => ({ id, type: "notice", text, tone, ...(params ? { params } : {}) }))
}

// Modes that run tools without asking, and the modes to use instead (first one the agent offers). From a phone,
// an agent should ask first: the permission cards are how the person stays in control.
const RISKY_MODES = new Set(["bypasspermissions", "yolo", "full-access", "dontask"])
const SAFE_MODES = ["default", "approve", "smart_approve", "read-only", "on-request"]

function modesFrom(raw: unknown): { modes: AgentMode[]; modeId: string } {
  if (!isObject(raw)) return { modes: [], modeId: "" }
  const modes = (Array.isArray(raw.availableModes) ? raw.availableModes : []).filter(isObject).map((m) => ({ id: str(m.id), name: str(m.name) || str(m.id), description: str(m.description) })).filter((m) => m.id)
  return { modes, modeId: str(raw.currentModeId) }
}

function modelFrom(configOptions: unknown): string {
  if (!Array.isArray(configOptions)) return ""
  const model = configOptions.find((o) => isObject(o) && (o.category === "model" || o.id === "model"))
  if (!isObject(model)) return ""
  const options = Array.isArray(model.options) ? model.options : []
  const current = options.find((o) => isObject(o) && o.value === model.currentValue)
  return isObject(current) ? str(current.name) || str(current.value) : str(model.currentValue)
}

function errorText(error: RpcMessage["error"]): string {
  return str(error?.message) || `error ${error?.code ?? ""}`.trim()
}

// ----- the reducer -----

function onResponse(state: AcpState, msg: RpcMessage): AcpState {
  const key = String(msg.id)
  const method = state.requests[key]
  if (!method) return state
  const { [key]: _done, ...requests } = state.requests
  let next: AcpState = { ...state, requests }
  const failed = !!msg.error
  if (method === "initialize") {
    if (failed) return { ...next, handshake: "failed", error: errorText(msg.error) }
    const r = isObject(msg.result) ? msg.result : {}
    return {
      ...next,
      handshake: "initialized",
      agentName: str(r.agentInfo?.name),
      agentVersion: str(r.agentInfo?.version),
      imagesAllowed: !!r.agentCapabilities?.promptCapabilities?.image,
      authMethods: Array.isArray(r.authMethods) ? r.authMethods.filter(isObject).map((m) => ({ id: str(m.id), name: str(m.name), type: str(m.type) })) : [],
    }
  }
  if (method === "session/new") {
    if (msg.error?.code === AUTH_REQUIRED) return { ...next, handshake: "auth-required" }
    if (failed) return { ...next, handshake: "failed", error: errorText(msg.error) }
    const r = isObject(msg.result) ? msg.result : {}
    const { modes, modeId } = modesFrom(r.modes)
    next = { ...next, handshake: "done", sessionId: str(r.sessionId) || null, modelName: modelFrom(r.configOptions), modes, modeId }
    const safe = RISKY_MODES.has(modeId.toLowerCase()) ? SAFE_MODES.map((id) => modes.find((m) => m.id === id)).find(Boolean) : undefined
    if (!safe) return next
    const from = modes.find((m) => m.id === modeId)
    return notice({ ...next, safeSwitch: { toId: safe.id } }, "safeMode", "info", { from: from?.name ?? modeId, to: safe.name })
  }
  if (method === "session/set_mode") return failed ? notice(next, errorText(msg.error), "error") : next
  if (method === "authenticate") {
    return failed ? { ...next, handshake: "failed", error: errorText(msg.error) } : { ...next, handshake: "initialized" }
  }
  if (method === "session/prompt") {
    next = { ...next, busy: false, pendingPermissions: [] }
    if (failed) return notice(next, errorText(msg.error), "error")
    const stop = str(msg.result?.stopReason)
    if (stop === "refusal") return notice(next, "refusal", "info")
    if (stop === "max_tokens" || stop === "max_turn_requests") return notice(next, stop, "info")
    return next
  }
  return next
}

function onUpdate(state: AcpState, update: Record<string, any>): AcpState {
  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      return appendText(state, "agent", blockText(update.content))
    case "agent_thought_chunk":
      return appendText(state, "thought", blockText(update.content))
    case "tool_call":
      return upsertTool(state, update, true)
    case "tool_call_update":
      return upsertTool(state, update, false)
    case "plan": {
      const entries: PlanEntry[] = (Array.isArray(update.entries) ? update.entries : []).filter(isObject).map((e) => ({
        content: str(e.content),
        priority: str(e.priority),
        status: e.status === "completed" || e.status === "in_progress" ? e.status : "pending",
      }))
      // One plan per turn: it is updated in place within the current turn, and a new turn gets its own.
      const lastUser = state.items.map((i) => i.type).lastIndexOf("user")
      const at = state.items.findIndex((i, n) => n > lastUser && i.type === "plan")
      if (at >= 0) return { ...state, items: state.items.map((i, n) => (n === at ? { ...i, entries } as ChatItem : i)) }
      return withItem(state, (id) => ({ id, type: "plan", entries }))
    }
    case "current_mode_update":
      return typeof update.currentModeId === "string" ? { ...state, modeId: update.currentModeId } : state
    case "available_commands_update":
      return { ...state, commands: (Array.isArray(update.availableCommands) ? update.availableCommands : []).filter(isObject).map((c) => ({ name: str(c.name), description: str(c.description) })) }
    case "usage_update":
      return Number.isFinite(update.used) && Number.isFinite(update.size) ? { ...state, usage: { used: update.used, size: update.size } } : state
    default:
      return state // user_message_chunk, modes, notices, ...: nothing to show
  }
}

function onAgentRequest(state: AcpState, msg: RpcMessage): AcpState {
  if (msg.method !== "session/request_permission" || msg.id === undefined || msg.id === null) return state
  const tool = isObject(msg.params?.toolCall) ? msg.params.toolCall : {}
  const rawOptions: any[] = Array.isArray(msg.params?.options) ? msg.params.options : []
  const options: PermissionOption[] = rawOptions.filter(isObject).map((o) => ({
    optionId: str(o.optionId),
    name: str(o.name),
    kind: o.kind === "allow_always" || o.kind === "reject_once" || o.kind === "reject_always" ? o.kind : "allow_once",
  }))
  const known = state.items.find((i) => i.type === "tool" && i.call.id === str(tool.toolCallId))
  const title = str(tool.title) || (known && known.type === "tool" ? known.call.title : "")
  const withTool = tool.toolCallId && !known ? upsertTool(state, tool, true) : state
  return { ...withTool, pendingPermissions: [...withTool.pendingPermissions.filter((p) => p.requestId !== msg.id), { requestId: msg.id, toolCallId: str(tool.toolCallId), title, options }] }
}

export function reduce(state: AcpState, event: StreamEvent): AcpState {
  const seq = typeof event.seq === "number" ? Math.max(state.lastSeq, event.seq) : state.lastSeq
  let next: AcpState = { ...state, lastSeq: seq }
  switch (event.kind) {
    case "live":
      return { ...next, replaying: false }
    case "gap":
      return notice(next, "gap", "info")
    case "exit":
      return { ...next, busy: false, pendingPermissions: [], exit: { code: event.code, stderr: event.stderr } }
    case "sent": {
      const msg = event.msg
      if (typeof msg.id === "number") next = { ...next, nextId: Math.max(next.nextId, msg.id + 1) }
      if (typeof msg.method === "string" && msg.id !== undefined && msg.id !== null) {
        next = { ...next, requests: { ...next.requests, [String(msg.id)]: msg.method } }
        if (msg.method === "initialize") next = { ...next, handshake: "initializing" }
        else if (msg.method === "session/new") next = { ...next, handshake: "creating" }
        else if (msg.method === "authenticate") next = { ...next, handshake: "authenticating" }
        else if (msg.method === "session/set_mode") next = { ...next, safeSwitch: null, modeId: str(msg.params?.modeId) || next.modeId }
        else if (msg.method === "session/prompt") {
          const blocks: unknown[] = Array.isArray(msg.params?.prompt) ? msg.params.prompt : []
          const text = blocks.map((b) => (isObject(b) && b.type === "text" ? str(b.text) : "")).join("")
          const images = blocks.filter((b) => isObject(b) && b.type === "image").length
          next = withItem({ ...next, busy: true, error: null }, (id) => ({ id, type: "user", text, images }))
        }
      } else if (msg.id !== undefined && msg.id !== null && !msg.method) {
        next = { ...next, pendingPermissions: next.pendingPermissions.filter((p) => p.requestId !== msg.id) } // the phone answered a permission request
      }
      return next
    }
    case "out": {
      const msg = event.msg
      if (typeof msg.method === "string") {
        if (msg.id !== undefined && msg.id !== null) return onAgentRequest(next, msg)
        if (msg.method === "session/update" && isObject(msg.params?.update)) return onUpdate(next, msg.params.update)
        return next
      }
      if (msg.id !== undefined && msg.id !== null) return onResponse(next, msg)
      return next
    }
  }
}

// ----- what the phone sends -----

export const initializeRequest = (id: number, version: string): RpcMessage => ({
  jsonrpc: "2.0",
  id,
  method: "initialize",
  params: {
    protocolVersion: PROTOCOL_VERSION,
    // No file or terminal access for the agent through the phone: it uses its own tools on the computer.
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: "opencode-mobile", title: "AgentLink", version },
  },
})

export const newSessionRequest = (id: number, cwd: string): RpcMessage => ({ jsonrpc: "2.0", id, method: "session/new", params: { cwd, mcpServers: [] } })

export const setModeRequest = (id: number, sessionId: string, modeId: string): RpcMessage => ({ jsonrpc: "2.0", id, method: "session/set_mode", params: { sessionId, modeId } })

export const authenticateRequest = (id: number, methodId: string): RpcMessage => ({ jsonrpc: "2.0", id, method: "authenticate", params: { methodId } })

export function promptRequest(id: number, sessionId: string, text: string, images: { data: string; mimeType: string }[] = []): RpcMessage {
  const prompt: unknown[] = [{ type: "text", text }, ...images.map((i) => ({ type: "image", data: i.data, mimeType: i.mimeType }))]
  return { jsonrpc: "2.0", id, method: "session/prompt", params: { sessionId, prompt } }
}

export const cancelNotification = (sessionId: string): RpcMessage => ({ jsonrpc: "2.0", method: "session/cancel", params: { sessionId } })

/** Answer to session/request_permission: the chosen option, or null for "cancelled". */
export const permissionResponse = (requestId: RpcId, optionId: string | null): RpcMessage => ({
  jsonrpc: "2.0",
  id: requestId,
  result: { outcome: optionId === null ? { outcome: "cancelled" } : { outcome: "selected", optionId } },
})

/** Requests this client does not serve (files, terminals, ...): answered at once, so the agent never waits for them. */
export function unsupportedRequestReply(msg: RpcMessage): RpcMessage | null {
  if (typeof msg.method !== "string" || msg.id === undefined || msg.id === null) return null
  if (msg.method === "session/request_permission") return null
  return { jsonrpc: "2.0", id: msg.id, error: { code: METHOD_NOT_FOUND, message: `${msg.method} is not supported by this client` } }
}

/** The next handshake message to send once the backlog has been read (null: nothing to send now). */
export function nextHandshakeStep(state: AcpState, cwd: string, version: string): RpcMessage | null {
  if (state.replaying || state.exit) return null
  const id = state.nextId
  switch (state.handshake) {
    case "none":
      return initializeRequest(id, version)
    case "initialized":
      return newSessionRequest(id, cwd)
    case "auth-required": {
      const method = state.authMethods.find((m) => m.type !== "terminal" && m.id)
      return method ? authenticateRequest(id, method.id) : null
    }
    case "done":
      return state.safeSwitch && state.sessionId ? setModeRequest(id, state.sessionId, state.safeSwitch.toId) : null
    default:
      return null
  }
}

/** Why the handshake cannot go on without the person doing something on the computer, or null. */
export function loginHint(state: AcpState): string | null {
  if (state.handshake !== "auth-required") return null
  const terminalOnly = state.authMethods.length > 0 && state.authMethods.every((m) => m.type === "terminal")
  return terminalOnly || state.authMethods.length === 0 ? state.authMethods.map((m) => m.name).filter(Boolean).join(", ") || "login" : null
}
