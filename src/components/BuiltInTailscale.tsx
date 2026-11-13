import { View, Text, Switch, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { cyber } from "../theme/cyber"
import { useTailnet } from "../stores/tailnet"

// Settings block: the app's own Tailscale node. Lets the phone reach a computer on a 100.x address
// while another VPN is on (Android allows only one VPN app at a time, this one needs no VPN slot).
export function BuiltInTailscale() {
  const { t } = useTranslation()
  const { available, enabled, status, setEnabled, signIn, signOut } = useTailnet()

  const needsSignIn = enabled && !!status?.authUrl && !status.ready
  const starting = enabled && !status?.ready && !status?.authUrl
  const state = !available
    ? t("tailnet.unavailable")
    : !enabled
      ? t("tailnet.hint")
      : status?.ready
        ? t("tailnet.connected", { ip: status.ip })
        : needsSignIn
          ? t("tailnet.needsSignIn")
          : t("tailnet.starting")

  return (
    <View style={s.root}>
      <View style={s.row}>
        <Ionicons name="git-network-outline" size={20} color={cyber.cyan} />
        <View style={s.text}>
          <Text style={s.label}>{t("tailnet.master")}</Text>
          <Text style={s.hint}>{state}</Text>
          {starting && status?.error ? <Text style={s.error}>{status.error}</Text> : null}
        </View>
        {starting ? <ActivityIndicator size="small" color={cyber.cyan} /> : null}
        <Switch value={enabled} onValueChange={(v) => void setEnabled(v)} disabled={!available} testID="tailnet-master" />
      </View>
      {needsSignIn ? (
        <TouchableOpacity style={s.button} onPress={() => void signIn()} testID="tailnet-sign-in">
          <Text style={s.buttonText}>{t("tailnet.signIn")}</Text>
        </TouchableOpacity>
      ) : null}
      {enabled && status?.ready ? (
        <TouchableOpacity style={s.link} onPress={() => void signOut()} testID="tailnet-sign-out">
          <Text style={s.linkText}>{t("tailnet.signOut")}</Text>
        </TouchableOpacity>
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
  error: { color: "#ff4d6d", fontSize: 11 },
  button: { backgroundColor: cyber.cyan, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#07080c", fontSize: 14, fontWeight: "600" },
  link: { paddingVertical: 8 },
  linkText: { color: cyber.muted, fontSize: 13, textDecorationLine: "underline" },
})
