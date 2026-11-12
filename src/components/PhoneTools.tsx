import { View, Text, Switch, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { cyber } from "../theme/cyber"
import { PHONE_TOOLS } from "../lib/phone-tools"
import { usePhoneTools } from "../stores/phoneTools"
import { useConnections } from "../stores/connections"

// Settings block: let the AI agent on the computer use a few phone functions. Everything starts off.
export function PhoneTools() {
  const { t } = useTranslation()
  const { enabled, allowed, log, setEnabled, setAllowed } = usePhoneTools()
  const hasBridge = useConnections((s) => !!s.activeConnection?.launcherPort)

  return (
    <View style={s.root}>
      <View style={s.row}>
        <Ionicons name="hardware-chip-outline" size={20} color={cyber.cyan} />
        <View style={s.text}>
          <Text style={s.label}>{t("phone.master")}</Text>
          <Text style={s.hint}>{hasBridge ? t("phone.masterHint") : t("phone.noBridge")}</Text>
        </View>
        <Switch value={enabled} onValueChange={(v) => void setEnabled(v)} disabled={!hasBridge} testID="phone-tools-master" />
      </View>
      {enabled
        ? PHONE_TOOLS.map((tool) => (
            <View key={tool.name} style={s.row}>
              <Ionicons name={tool.icon as never} size={18} color={cyber.muted} />
              <View style={s.text}>
                <Text style={s.label}>{t(`phone.tools.${tool.name}`)}</Text>
                {tool.confirmEachTime ? <Text style={s.hint}>{t("phone.asksEachTime")}</Text> : null}
              </View>
              <Switch value={!!allowed[tool.name]} onValueChange={(v) => void setAllowed(tool.name, v)} />
            </View>
          ))
        : null}
      {enabled && log.length > 0 ? (
        <View style={s.log}>
          <Text style={s.hint}>{t("phone.recent")}</Text>
          {log.slice(0, 8).map((e, i) => (
            <Text key={`${e.time}-${i}`} style={s.logLine}>
              {new Date(e.time).toLocaleTimeString()}  {e.tool}  {t(`phone.outcome.${e.outcome}`)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  label: { color: cyber.text, fontSize: 14 },
  hint: { color: cyber.muted, fontSize: 12 },
  log: { marginTop: 8, gap: 2 },
  logLine: { color: cyber.muted, fontSize: 11, fontFamily: cyber.mono },
})
