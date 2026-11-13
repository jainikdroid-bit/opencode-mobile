// One chat with an agent on the computer, over the launcher's ACP bridge. The chat itself is a function of the
// event stream (protocol.ts); this hook starts or reopens the agent, keeps the stream connected (reading on from
// the last event it has after a drop), drives the handshake and sends what the person does.
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import pkg from "../../../package.json"
import { AcpApiError, sendMessage, startAgent, stopAgent, streamEvents, type AcpTarget } from "./api"
import {
  cancelNotification, initialState, nextHandshakeStep, permissionResponse, promptRequest, reduce, setModeRequest, unsupportedRequestReply, type AcpState, type RpcMessage,
} from "./protocol"

export type LinkState = "starting" | "connecting" | "live" | "reconnecting"

export interface AcpChatParams {
  agent: string
  /** Folder on the computer for a new agent. */
  cwd?: string
  /** Reopen an agent that is already running. */
  existingId?: string
}

const RECONNECT_FIRST_MS = 1_000
const RECONNECT_MAX_MS = 10_000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function useAcpChat(target: AcpTarget | null, params: AcpChatParams) {
  const [state, dispatch] = useReducer(reduce, initialState)
  const [handle, setHandle] = useState<{ id: string; cwd: string } | null>(null)
  const [link, setLink] = useState<LinkState>("starting")
  const [fatal, setFatal] = useState<string | null>(null)
  const stateRef = useRef<AcpState>(state)
  stateRef.current = state
  const targetRef = useRef(target)
  targetRef.current = target
  const lastSeq = useRef(0) // updated as events are read, ahead of the render
  const idFloor = useRef(1)
  const stepSent = useRef<string | null>(null)

  // 1. Start the agent (or reopen a running one).
  useEffect(() => {
    let cancelled = false
    const t = targetRef.current
    if (!t) return
    if (params.existingId) {
      setHandle({ id: params.existingId, cwd: params.cwd ?? "" })
      return
    }
    startAgent(t, params.agent, params.cwd)
      .then((started) => { if (!cancelled) setHandle({ id: started.id, cwd: started.cwd }) })
      .catch((error: unknown) => { if (!cancelled) setFatal(error instanceof Error ? error.message : String(error)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.agent, params.cwd, params.existingId])

  // 2. Keep the event stream connected; after a drop, read on from the last event seen.
  useEffect(() => {
    if (!handle) return
    const controller = new AbortController()
    let finished = false
    const reply = (message: RpcMessage) => {
      const t = targetRef.current
      if (t) void sendMessage(t, handle.id, message).catch(() => undefined)
    }
    ;(async () => {
      let delay = RECONNECT_FIRST_MS
      while (!finished && !controller.signal.aborted) {
        const t = targetRef.current
        if (!t) return
        setLink((was) => (was === "live" ? "reconnecting" : was === "reconnecting" ? was : "connecting"))
        stepSent.current = null
        try {
          for await (const event of streamEvents(t, handle.id, lastSeq.current + 1, controller.signal)) {
            if ("seq" in event && typeof event.seq === "number") {
              if (event.seq <= lastSeq.current) continue // already read before the drop
              lastSeq.current = event.seq
            }
            if (event.kind === "live") {
              setLink("live")
              delay = RECONNECT_FIRST_MS
            }
            if (event.kind === "out") {
              const refusal = unsupportedRequestReply(event.msg)
              if (refusal) reply(refusal)
            }
            dispatch(event)
            if (event.kind === "exit") finished = true
          }
        } catch (error) {
          if (controller.signal.aborted) return
          if (error instanceof AcpApiError && error.status === 404) {
            setFatal(error.message)
            return
          }
        }
        if (finished || controller.signal.aborted) return
        setLink("reconnecting")
        await sleep(delay)
        delay = Math.min(delay * 1.5, RECONNECT_MAX_MS)
      }
    })()
    return () => {
      finished = true
      controller.abort()
    }
  }, [handle])

  // 3. The handshake, once the backlog has been read (the chat may already exist).
  useEffect(() => {
    const t = targetRef.current
    if (!t || !handle) return
    const step = nextHandshakeStep(state, handle.cwd, pkg.version)
    if (!step) return
    const key = `${state.handshake}:${state.nextId}`
    if (stepSent.current === key) return
    stepSent.current = key
    sendMessage(t, handle.id, step).catch(() => { stepSent.current = null })
  }, [state, handle])

  const post = useCallback(async (message: RpcMessage) => {
    const t = targetRef.current
    if (!t || !handle) throw new Error("not connected")
    await sendMessage(t, handle.id, message)
  }, [handle])

  const send = useCallback(async (text: string, images: { data: string; mimeType: string }[] = []) => {
    const current = stateRef.current
    if (!current.sessionId) throw new Error("the chat is not ready yet")
    const id = Math.max(current.nextId, idFloor.current)
    idFloor.current = id + 1
    await post(promptRequest(id, current.sessionId, text, images))
  }, [post])

  const cancel = useCallback(async () => {
    const current = stateRef.current
    if (!current.sessionId) return
    // A turn waiting on a permission request must be answered "cancelled" or it never ends.
    for (const pending of current.pendingPermissions) await post(permissionResponse(pending.requestId, null)).catch(() => undefined)
    await post(cancelNotification(current.sessionId))
  }, [post])

  const setMode = useCallback(async (modeId: string) => {
    const current = stateRef.current
    if (!current.sessionId) return
    const id = Math.max(current.nextId, idFloor.current)
    idFloor.current = id + 1
    await post(setModeRequest(id, current.sessionId, modeId))
  }, [post])

  const answer = useCallback((requestId: string | number, optionId: string) => post(permissionResponse(requestId, optionId)), [post])

  const stop = useCallback(async () => {
    const t = targetRef.current
    if (t && handle) await stopAgent(t, handle.id)
  }, [handle])

  return { state, link, fatal, agentId: handle?.id ?? null, send, cancel, answer, setMode, stop }
}
