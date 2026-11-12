import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator, Alert } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../src/stores/connections"
import { buildPairing } from "../src/lib/pairing"

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
  const params = useLocalSearchParams<{ url?: string; password?: string; name?: string }>()
  const { addConnection, testConnection } = useConnections()
  const [busy, setBusy] = useState(false)

  const pairing = buildPairing(params.url, params.password, params.name)

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"))

  const handleConnect = async () => {
    if (!pairing || busy) return
    setBusy(true)
    const result = await testConnection(
      { id: "", name: pairing.name, type: "local", url: pairing.url },
      "onboarding",
      pairing.password,
    )
    if (!result.ok) {
      setBusy(false)
      Alert.alert(t("connection.pair.failedTitle"), `${pairing.url}\n${result.error ?? ""}`.trim())
      return
    }
    try {
      await addConnection(
        { name: pairing.name, type: "local", url: pairing.url, api: result.api, serverVersion: result.serverVersion },
        pairing.password,
      )
      router.replace("/")
    } catch {
      setBusy(false)
      Alert.alert(t("connection.shared.alerts.saveFailedTitle"), t("connection.shared.alerts.saveFailedMessage"))
    }
  }

  if (!pairing) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
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
      <Ionicons name="link-outline" size={48} color="#6366f1" />
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
  containerDark: { backgroundColor: "#0a0a0a" },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center", color: "#111111" },
  textDark: { color: "#ffffff" },
  body: { fontSize: 14, textAlign: "center", color: "#666666" },
  hintDark: { color: "#999999" },
  card: { width: "100%", padding: 16, borderRadius: 12, backgroundColor: "#f4f4f5", gap: 4 },
  cardDark: { backgroundColor: "#1a1a1a" },
  name: { fontSize: 17, fontWeight: "600", color: "#111111" },
  url: { fontSize: 14, color: "#666666" },
  primary: { width: "100%", height: 52, borderRadius: 12, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 17, fontWeight: "600", color: "#ffffff" },
  secondary: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryText: { fontSize: 16, color: "#111111" },
})
