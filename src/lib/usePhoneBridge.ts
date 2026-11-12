import { useEffect } from "react"
import { AppState } from "react-native"
import { useTranslation } from "react-i18next"
import { useConnections } from "../stores/connections"
import { usePhoneTools } from "../stores/phoneTools"
import { buildRequestHeaders } from "./headers"
import { bridgeUrl, checkArgs, decide, type PhoneToolName } from "./phone-tools"
import { confirm, runPhoneTool } from "./phone-handlers"

const RETRY_MS = 5000

// While the app is open and phone tools are switched on, waits for the agent's requests on the computer
// (long poll to tools/phone-bridge.js), checks them against the user's settings and answers.
export function usePhoneBridge() {
  const { t } = useTranslation()
  const connection = useConnections((s) => s.activeConnection)
  const clientBase = useConnections((s) => s.clientBase)
  const enabled = usePhoneTools((s) => s.enabled)
  const loaded = usePhoneTools((s) => s.loaded)

  useEffect(() => {
    void usePhoneTools.getState().load()
  }, [])

  useEffect(() => {
    const base = connection ? bridgeUrl(connection.url, connection.launcherPort) : null
    if (!loaded || !enabled || !base) return
    let stopped = false
    let foreground = AppState.currentState === "active"
    const controller = new AbortController()
    const headers = () => ({ ...buildRequestHeaders({ auth: clientBase?.auth }), "Content-Type": "application/json" })
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const sub = AppState.addEventListener("change", (s) => {
      foreground = s === "active"
    })

    const answer = (id: string, body: { ok: boolean; data?: unknown; error?: string }) =>
      fetch(`${base}/result`, { method: "POST", headers: headers(), body: JSON.stringify({ id, ...body }), signal: controller.signal }).catch(() => {})

    async function handle(job: { id: string; tool: string; args: unknown }) {
      const { record, ...settings } = usePhoneTools.getState()
      const decision = decide(settings, job.tool)
      if (decision === "deny") {
        record({ time: Date.now(), tool: job.tool, outcome: "off" })
        return answer(job.id, { ok: false, error: `the user has not allowed ${job.tool} on the phone` })
      }
      const tool = job.tool as PhoneToolName
      const checked = checkArgs(tool, job.args)
      if (!checked.ok) {
        record({ time: Date.now(), tool, outcome: "error" })
        return answer(job.id, { ok: false, error: checked.error })
      }
      if (decision === "ask") {
        const allowed = await confirm(t("phone.confirmTitle"), t(`phone.confirm.${tool}`), t("phone.allow"), t("phone.decline"))
        if (!allowed) {
          record({ time: Date.now(), tool, outcome: "declined" })
          return answer(job.id, { ok: false, error: "the user declined on the phone" })
        }
      }
      try {
        const data = await runPhoneTool(tool, checked.args)
        record({ time: Date.now(), tool, outcome: "done" })
        return answer(job.id, { ok: true, data })
      } catch (error) {
        record({ time: Date.now(), tool, outcome: "error" })
        return answer(job.id, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }

    void (async () => {
      while (!stopped) {
        if (!foreground) {
          await sleep(1000)
          continue
        }
        try {
          const res = await fetch(`${base}/poll`, { headers: headers(), signal: controller.signal })
          if (res.status === 200) void handle(await res.json())
          else if (res.status !== 204) await sleep(RETRY_MS)
        } catch {
          if (stopped) break
          await sleep(RETRY_MS)
        }
      }
    })()

    return () => {
      stopped = true
      controller.abort()
      sub.remove()
    }
  }, [connection, clientBase, enabled, loaded, t])
}
