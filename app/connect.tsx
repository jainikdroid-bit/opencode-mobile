import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator, Alert } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../src/stores/connections"
import { buildPairing } from "../src/lib/pairing"
import { Mascot } from "../src/components/Mascot"
import { useTailnet } from "../src/stores/tailnet"
import { tailnetTarget } from "../src/lib/tailnet-host"
import { setLanRoutes } from "../src/lib/tailnet"

const TAILNET_SIGN_IN_WAIT_MS = 5 * 60_000

// Landing screen for OpenCode Connect pairing links
// (opencode://connect?url=...&password=...&name=...), opened by scanning the QR
// code from tools/opencode-connect.ps1 with the phone camera, or via the
// "Paste pairing link" button on the Add Connection screen.
//
// A deep link can be triggered by any web page or app, so nothing is added
// until the user explicitly confirms the server shown here.
export default function ConnectScreen() {
  const isDark = useColorScheme() === "dark"
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ url?: string; password?: string; name?: string; launcher?: string; topic?: string; lan?: string }>()
  const { addConnection, testConnection, setActiveConnection } = useConnections()
  const [busy, setBusy] = useState(false)
  const [waitingTailnet, setWaitingTailnet] = useState(false)

  const pairing = buildPairing(params.url, params.password, params.name, params.launcher, params.topic, params.lan)

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"))

  const handleConnect = async () => {
    if (!pairing || busy) return
    setBusy(true)
    // At home the computer answers on its home-network address: test there first (no Tailscale or VPN needed).
    // Kept in its own slot until the end of this attempt; once saved, the connection carries it.
    const remote = /^http:\/\/([^/:?#\s]+)(?::(\d+))?/i.exec(pairing.url)
    if (pairing.lanHost && pairing.password && remote) {
      setLanRoutes(
        [{ remoteHost: remote[1], lanHost: pairing.lanHost, launcherPort: pairing.launcherPort ?? Number(remote[2] || 80) - 1, password: pairing.password }],
        "pairing",
      )
    }
    try {
      await connectPaired()
    } finally {
      setLanRoutes([], "pairing")
    }
  }

  const connectPaired = async () => {
    if (!pairing) return
    const result = await testConnection(
      { id: "", name: pairing.name, type: "local", url: pairing.url },
      "onboarding",
      pairing.password,
    )
    if (!result.ok) {
      setBusy(false)
      const tailnet = useTailnet.getState()
      // A tailnet address the phone cannot reach: usually the Tailscale app is off because another VPN is on.
      if (tailnetTarget(pairing.url) && tailnet.available && !tailnet.status?.ready) {
        Alert.alert(t("connection.pair.failedTitle"), `${pairing.url}\n${t("tailnet.offer")}`, [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("tailnet.useBuiltIn"), onPress: () => void connectThroughTailnet() },
        ])
        return
      }
      Alert.alert(t("connection.pair.failedTitle"), `${pairing.url}\n${result.error ?? ""}`.trim())
      return
    }
    try {
      const details = {
        name: pairing.name,
        type: "local" as const,
        url: pairing.url,
        api: result.api,
        serverVersion: result.serverVersion,
        launcherPort: pairing.launcherPort,
        tunnelTopic: pairing.tunnelTopic,
        lanHost: pairing.lanHost,
      }
      // The same computer paired again (a newer link, say with its home-network address): update it, no twin.
      const existing = useConnections.getState().connections.find((c) => c.url.replace(/\/+$/, "") === pairing.url)
      if (existing) await useConnections.getState().updateConnection(existing.id, details, pairing.password)
      else await addConnection(details, pairing.password)
      // Pairing means "use this computer now": switch to it (addConnection only activates the very first one).
      const target = existing ?? useConnections.getState().connections.at(-1)
      if (target) await setActiveConnection(target.id)
      router.replace("/")
    } catch {
      setBusy(false)
      Alert.alert(t("connection.shared.alerts.saveFailedTitle"), t("connection.shared.alerts.saveFailedMessage"))
    }
  }

  const connectThroughTailnet = async () => {
    setWaitingTailnet(true)
    const tailnet = useTailnet.getState()
    await tailnet.setEnabled(true)
    const ready = await tailnet.waitReady(TAILNET_SIGN_IN_WAIT_MS)
    setWaitingTailnet(false)
    if (!ready) {
      Alert.alert(t("connection.pair.failedTitle"), t("tailnet.notConnected"))
      return
    }
    await handleConnect()
  }

  if (waitingTailnet) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]} testID="connect-tailnet-wait">
        <ActivityIndicator size="large" color="#22d3ee" />
        <Text style={[styles.title, isDark && styles.textDark]}>{t("tailnet.waitTitle")}</Text>
        <Text style={[styles.body, isDark && styles.hintDark]}>{t("tailnet.waitBody")}</Text>
        <TouchableOpacity style={styles.secondary} onPress={() => void useTailnet.getState().signIn()}>
          <Text style={[styles.secondaryText, isDark && styles.textDark]}>{t("tailnet.signIn")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => void useTailnet.getState().setEnabled(false)}>
          <Text style={[styles.secondaryText, isDark && styles.textDark]}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!pairing) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Ionicons name="alert-circle-outline" size={48} color="#ff4d6d" />
        <Text style={[styles.title, isDark && styles.textDark]}>{t("connection.pair.invalidTitle")}</Text>
        <Text style={[styles.body, isDark && styles.hintDark]}>{t("connection.pair.invalidMessage")}</Text>
        <TouchableOpacity style={styles.secondary} onPress={close}>
          <Text style={[styles.secondaryText, isDark && styles.textDark]}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]} testID="connect-screen">
      <Mascot state="idle" size={96} />
      <Text style={[styles.title, isDark && styles.textDark]}>{t("connection.pair.confirmText")}</Text>
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.name, isDark && styles.textDark]}>{pairing.name}</Text>
        <Text style={[styles.url, isDark && styles.hintDark]}>{pairing.url}</Text>
      </View>
      <Text style={[styles.body, isDark && styles.hintDark]}>{t("connection.pair.confirmWarning")}</Text>
      <TouchableOpacity style={styles.primary} onPress={handleConnect} disabled={busy} testID="connect-confirm">
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryText}>{t("connection.pair.connect")}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={close} disabled={busy} testID="connect-cancel">
        <Text style={[styles.secondaryText, isDark && styles.textDark]}>{t("common.cancel")}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: "#ffffff" },
  containerDark: { backgroundColor: "#07080c" },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center", color: "#0a0d14" },
  textDark: { color: "#ffffff" },
  body: { fontSize: 14, textAlign: "center", color: "#8a93a8" },
  hintDark: { color: "#8a93a8" },
  card: { width: "100%", padding: 16, borderRadius: 12, backgroundColor: "#141926", gap: 4 },
  cardDark: { backgroundColor: "#0d1018" },
  name: { fontSize: 17, fontWeight: "600", color: "#0a0d14" },
  url: { fontSize: 14, color: "#8a93a8" },
  primary: { width: "100%", height: 52, borderRadius: 12, backgroundColor: "#0891b2", alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 17, fontWeight: "600", color: "#ffffff" },
  secondary: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryText: { fontSize: 16, color: "#0a0d14" },
})
