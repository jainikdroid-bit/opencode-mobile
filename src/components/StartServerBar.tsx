import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"
import { Mascot } from "./Mascot"
import { cyber } from "../theme/cyber"
import { startServerFromPhone, type LauncherTarget } from "../lib/launcher-api"

type Phase = { kind: "idle" } | { kind: "starting" } | { kind: "failed"; reason: string }

// Shown when the server on the computer does not answer but a launcher is paired: one tap starts it.
export function StartServerBar({ target, onStarted }: { target: LauncherTarget; onStarted: () => void }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })

  const start = async () => {
    setPhase({ kind: "starting" })
    const outcome = await startServerFromPhone(target)
    if (outcome.kind === "started") {
      setPhase({ kind: "idle" })
      onStarted()
    } else {
      setPhase({ kind: "failed", reason: outcome.reason })
    }
  }

  const starting = phase.kind === "starting"
  return (
    <View style={s.bar} testID="start-server-bar">
      <Mascot state={starting ? "working" : "offline"} size={52} />
      <View style={s.text}>
        <Text style={s.title}>{t(starting ? "launcher.starting" : "launcher.offlineTitle")}</Text>
        {phase.kind === "failed" ? <Text style={s.error}>{t(`launcher.failed.${phase.reason}`)}</Text> : null}
        {phase.kind === "idle" ? <Text style={s.hint}>{t("launcher.hint")}</Text> : null}
      </View>
      {!starting ? (
        <TouchableOpacity style={s.button} onPress={() => void start()} testID="start-server-button">
          <Text style={s.buttonText}>{t(phase.kind === "failed" ? "launcher.retry" : "launcher.start")}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: cyber.borderGlow,
    backgroundColor: cyber.surface,
  },
  text: { flex: 1, gap: 2 },
  title: { color: cyber.text, fontSize: 14, fontWeight: "600" },
  hint: { color: cyber.muted, fontSize: 12 },
  error: { color: cyber.amber, fontSize: 12 },
  button: { backgroundColor: cyber.cyan, borderRadius: 8, paddingHorizontal: 14, height: 40, alignItems: "center", justifyContent: "center" },
  buttonText: { color: cyber.bg, fontWeight: "700", fontSize: 13 },
})
