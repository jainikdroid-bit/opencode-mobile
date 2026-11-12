import { useEffect, useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from "react-native"
import { router } from "expo-router"
import * as Clipboard from "expo-clipboard"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../../src/stores/connections"
import type { ConnectionType } from "../../src/lib/types"
import { probeConnection, shareReport } from "../../src/lib/diagnostics"
import { parseUrl } from "../../src/lib/diagnostics-classify"
import { buildAuth } from "../../src/lib/auth"
import { parsePairingLink } from "../../src/lib/pairing"


export default function AddConnectionScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { addConnection, testConnection } = useConnections()

  const [mode, setMode] = useState<"quick" | "advanced">("quick")
  const [type, setType] = useState<ConnectionType>("local")
  const [name, setName] = useState("")
  const [ip, setIp] = useState("")
  const [port, setPort] = useState("4096")
  const [url, setUrl] = useState("")
  const [directory, setDirectory] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const buildUrl = () => {
    if (mode === "advanced") return url.trim()
    const raw = ip.trim()
    if (!raw) return ""
    // Be forgiving about pasted values: a full URL, a host:port, or a
    // host with a trailing path. Extract scheme, host, and port so we
    // never produce "http://http://host:4096:4096".
    const schemeMatch = raw.match(/^(https?):\/\//i)
    const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : "http"
    let rest = raw.replace(/^https?:\/\//i, "")
    rest = rest.split("/")[0] // drop any path/query
    let host = rest
    let pastedPort = ""
    const lastColon = rest.lastIndexOf(":")
    // Only treat trailing ":NNNN" as a port (ignore IPv6 colons / bare host)
    if (lastColon > -1 && /^\d+$/.test(rest.slice(lastColon + 1))) {
      host = rest.slice(0, lastColon)
      pastedPort = rest.slice(lastColon + 1)
    }
    const finalPort = pastedPort || port.trim() || "4096"
    return `${scheme}://${host}:${finalPort}`
  }

  const handleQuickConnect = async () => {
    const serverUrl = buildUrl()
    if (!serverUrl) {
      Alert.alert(t("common.error"), t("connection.add.alerts.enterIp"))
      return
    }

    setIsConnecting(true)

    // Test connection first. Quick Connect has no username field, so the
    // connection is intentionally saved without one — buildAuth() defaults
    // it to "opencode" wherever auth is built. Sending the `username` state
    // here would leak a value typed earlier in Advanced mode (issue: Back to
    // Quick silently overriding the default).
    const result = await testConnection(
      {
        id: "",
        name: name || t("connection.shared.namePlaceholder"),
        type: "local",
        url: serverUrl,
      },
      "onboarding",
      password || undefined,
    )

    if (result.ok) {
      // Save and go back
      try {
        await addConnection(
          {
            name: name.trim() || t("connection.shared.namePlaceholder"),
            type: "local",
            url: serverUrl,
            // Carry the transport the pre-flight probe already determined, so the
            // save does not probe the same server a second time.
            api: result.api,
            serverVersion: result.serverVersion,
          },
          password || undefined,
        )
        setIsConnecting(false)
        router.back()
      } catch {
        setIsConnecting(false)
        Alert.alert(
          t("connection.shared.alerts.saveFailedTitle"),
          t("connection.shared.alerts.saveFailedMessage"),
        )
      }
    } else {
      // Failed: run active diagnostics and offer a shareable report.
      const report = await probeConnection(serverUrl, buildAuth(undefined, password))
      setIsConnecting(false)
      Alert.alert(
        t("connection.shared.alerts.connectionFailedTitle"),
        t("connection.add.alerts.connectionFailedMessage", {
          summary: report.summary,
          target: serverUrl,
          error: result.error || t("connection.shared.alerts.unknownError"),
        }),
        [
          { text: t("common.ok"), style: "cancel" },
          { text: t("common.shareReport"), onPress: () => shareReport(report) },
        ],
      )
    }
  }

  // OpenCode Connect: take a pairing link from the clipboard and hand it to the
  // confirmation screen (same one the camera/QR deep link opens).
  const handlePastePairingLink = async () => {
    const pairing = parsePairingLink(await Clipboard.getStringAsync().catch(() => ""))
    if (!pairing) {
      Alert.alert(t("connection.pair.invalidTitle"), t("connection.pair.clipboardEmpty"))
      return
    }
    router.push({
      pathname: "/connect",
      params: { url: pairing.url, password: pairing.password ?? "", name: pairing.name, launcher: pairing.launcherPort ? String(pairing.launcherPort) : "" },
    })
  }

  const handleAdvancedSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterName"))
      return
    }
    if (!url.trim()) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterUrl"))
      return
    }
    if (!parseUrl(url).valid) {
      Alert.alert(t("connection.shared.alerts.invalidUrlTitle"), t("connection.shared.alerts.invalidUrlMessage"))
      return
    }

    setIsConnecting(true)

    // Pre-flight, mirroring Quick Connect: previously Advanced mode saved
    // directly with no health check, so bad credentials (401/403) or an
    // unreachable server silently became the active connection with zero
    // feedback (issue #76).
    const result = await testConnection(
      {
        id: "",
        name: name.trim(),
        type,
        url: url.trim(),
        directory: directory.trim() || undefined,
        username: username.trim() || undefined,
      },
      "onboarding",
      password || undefined,
    )

    if (result.ok) {
      try {
        await addConnection(
          {
            name: name.trim(),
            type,
            url: url.trim(),
            directory: directory.trim() || undefined,
            username: username.trim() || undefined,
            api: result.api,
            serverVersion: result.serverVersion,
          },
          password || undefined,
        )
        setIsConnecting(false)
        router.back()
      } catch {
        setIsConnecting(false)
        Alert.alert(
          t("connection.shared.alerts.saveFailedTitle"),
          t("connection.shared.alerts.saveFailedMessage"),
        )
      }
      return
    }

    // Failed: same "Connection Failed" alert as Quick Connect — run active
    // diagnostics and offer a shareable report instead of
    // silently persisting an unreachable/unauthorized connection.
    const report = await probeConnection(url.trim(), buildAuth(username, password))
    setIsConnecting(false)
    Alert.alert(
      t("connection.shared.alerts.connectionFailedTitle"),
      t("connection.add.alerts.connectionFailedMessage", {
        summary: report.summary,
        target: url.trim(),
        error: result.error || t("connection.shared.alerts.unknownError"),
      }),
      [
        { text: t("common.ok"), style: "cancel" },
        { text: t("common.shareReport"), onPress: () => shareReport(report) },
      ],
    )
  }

  // Quick connect mode - simplified
  if (mode === "quick") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, isDark && styles.containerDark]}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.quickHeader}>
          <Ionicons name="wifi" size={48} color={isDark ? "#ffffff" : "#07080c"} />
          <Text style={[styles.quickTitle, isDark && styles.textDark]}>{t("connection.add.quick.title")}</Text>
          <Text style={[styles.quickSubtitle, isDark && styles.hintDark]}>{t("connection.add.quick.subtitle")}</Text>
        </View>

        {/* IP Address */}
        <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.add.quick.ipAddressLabel")}</Text>
        <View style={styles.ipRow}>
          <TextInput
            style={[styles.input, styles.ipInput, isDark && styles.inputDark]}
            placeholder="192.168.1.100"
            placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
            value={ip}
            onChangeText={setIp}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID="connect-ip-input"
          />
          <Text style={[styles.ipColon, isDark && styles.textDark]}>:</Text>
          <TextInput
            style={[styles.input, styles.portInput, isDark && styles.inputDark]}
            placeholder="4096"
            placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
            testID="connect-port-input"
          />
        </View>

        {/* Optional name */}
        <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.add.quick.nameOptionalLabel")}</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t("connection.add.quick.namePlaceholder")}
          placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
          value={name}
          onChangeText={setName}
        />

        {/* Password if needed */}
        <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.add.quick.passwordIfSetLabel")}</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t("connection.add.quick.passwordPlaceholder")}
          placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          testID="connect-password-input"
        />
        <Text style={[styles.usernameHint, isDark && styles.hintDark]}>
          {t("connection.add.quick.usernameHintPrefix")}
          <Text style={styles.code}>opencode</Text>
          {t("connection.add.quick.usernameHintMiddle")}
          <Text style={styles.usernameHintLink} onPress={() => setMode("advanced")}>
            {t("connection.add.quick.advancedOptionsLink")}
          </Text>
          {t("connection.add.quick.usernameHintSuffix")}
        </Text>

        {/* Connect button */}
        <TouchableOpacity
          style={[styles.connectButton, isDark && styles.connectButtonDark]}
          onPress={handleQuickConnect}
          disabled={isConnecting}
          testID="connect-submit-button"
        >
          {isConnecting ? (
            <ActivityIndicator size="small" color={isDark ? "#07080c" : "#ffffff"} />
          ) : (
            <>
              <Ionicons name="flash" size={20} color={isDark ? "#07080c" : "#ffffff"} />
              <Text style={[styles.connectButtonText, isDark && styles.connectButtonTextDark]}>
                {t("connection.add.quick.connectButton")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Help text */}
        <View style={[styles.helpBox, isDark && styles.helpBoxDark]}>
          <Text style={[styles.helpTitle, isDark && styles.textDark]}>{t("connection.add.quick.helpTitle")}</Text>
          <Text style={[styles.helpText, isDark && styles.hintDark]}>
            {t("connection.add.quick.helpMacPrefix")}
            {"\n"}
            <Text style={styles.code}>ipconfig getifaddr en0</Text>
          </Text>
          <Text style={[styles.helpText, isDark && styles.hintDark, { marginTop: 8 }]}>
            {t("connection.add.quick.helpTailscalePrefix")}
            {"\n"}
            <Text style={styles.code}>http://100.64.12.34:4096</Text>
            {"\n"}
            <Text style={styles.code}>http://my-mac.tailnet.ts.net:4096</Text>
          </Text>
          <Text style={[styles.helpText, isDark && styles.hintDark, { marginTop: 8 }]}>
            {t("connection.add.quick.helpProtocolPrefix")}
            <Text style={styles.code}>http://</Text>
            {t("connection.add.quick.helpProtocolMiddle")}
            <Text style={styles.code}>https://</Text>
            {t("connection.add.quick.helpProtocolSuffix")}
          </Text>
          <Text style={[styles.helpText, isDark && styles.hintDark, { marginTop: 8 }]}>
            {t("connection.add.quick.helpRunningPrefix")}
            {"\n"}
            <Text style={styles.code}>opencode serve --hostname 0.0.0.0</Text>
          </Text>
        </View>

        {/* OpenCode Connect — self-hosted pairing (QR / link from tools/opencode-connect.ps1) */}
        <View style={[styles.connectCard, isDark && styles.connectCardDark]}>
          <View style={styles.connectCardHeader}>
            <Ionicons name="cloud-done-outline" size={28} color="#0891b2" />
            <View style={styles.connectCardTitles}>
              <Text style={[styles.connectCardTitle, isDark && styles.textDark]}>
                {t("connection.add.quick.connectCardTitle")}
              </Text>
              <View style={styles.connectCardBadge}>
                <Text style={styles.connectCardBadgeText}>{t("connection.add.quick.connectCardBadge")}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.connectCardDesc, isDark && styles.hintDark]}>
            {t("connection.add.quick.connectCardDesc")}
          </Text>
          <TouchableOpacity style={[styles.pairButton, { marginBottom: 8 }]} onPress={() => router.push("/scan")} testID="pair-scan-button">
            <Ionicons name="qr-code-outline" size={16} color="#ffffff" />
            <Text style={styles.pairButtonText}>{t("scan.button")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pairButton} onPress={handlePastePairingLink} testID="pair-paste-button">
            <Ionicons name="clipboard-outline" size={16} color="#ffffff" />
            <Text style={styles.pairButtonText}>{t("connection.pair.pasteButton")}</Text>
          </TouchableOpacity>
        </View>

        {/* Advanced mode link */}
        <TouchableOpacity style={styles.advancedLink} onPress={() => setMode("advanced")}>
          <Text style={[styles.advancedLinkText, isDark && styles.hintDark]}>
            {t("connection.add.quick.advancedLink")}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={isDark ? "#8a93a8" : "#8a93a8"} />
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // Advanced mode - full options
  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && styles.containerDark]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.backToQuick} onPress={() => setMode("quick")}>
        <Ionicons name="chevron-back" size={16} color={isDark ? "#8a93a8" : "#8a93a8"} />
        <Text style={[styles.backToQuickText, isDark && styles.hintDark]}>{t("connection.add.advanced.backToQuick")}</Text>
      </TouchableOpacity>

      {/* Connection Type */}
      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.connectionType")}</Text>
      <View style={styles.typeContainer}>
        {[
          { type: "local" as const, label: t("connection.shared.types.local"), icon: "wifi" as const },
          { type: "tunnel" as const, label: t("connection.shared.types.tunnel"), icon: "globe" as const },
          { type: "cloud" as const, label: t("connection.shared.types.cloud"), icon: "cloud" as const },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.type}
            style={[
              styles.typeOption,
              isDark && styles.typeOptionDark,
              type === opt.type && styles.typeOptionSelected,
              type === opt.type && isDark && styles.typeOptionSelectedDark,
            ]}
            onPress={() => setType(opt.type)}
          >
            <Ionicons
              name={opt.icon}
              size={20}
              color={type === opt.type ? (isDark ? "#07080c" : "#ffffff") : isDark ? "#8a93a8" : "#8a93a8"}
            />
            <Text
              style={[
                styles.typeLabel,
                isDark && styles.textDark,
                type === opt.type && styles.typeLabelSelected,
                type === opt.type && isDark && styles.typeLabelSelectedDark,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Name */}
      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.name")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder={t("connection.shared.namePlaceholder")}
        placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
        value={name}
        onChangeText={setName}
      />

      {/* URL */}
      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.serverUrl")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder={
          type === "local"
            ? "http://192.168.1.100:4096"
            : type === "tunnel"
              ? "https://your-tunnel.trycloudflare.com"
              : "https://api.opencode.ai"
        }
        placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={[styles.hint, isDark && styles.hintDark]}>
        {t("connection.add.advanced.urlHintPrefix")}
        <Text style={styles.code}>http://100.64.12.34:4096</Text>
        {t("connection.add.advanced.urlHintOr")}
        <Text style={styles.code}>http://my-mac.tailnet.ts.net:4096</Text>
        {t("connection.add.advanced.urlHintUse")}
        <Text style={styles.code}>https://</Text>
        {t("connection.add.advanced.urlHintSuffix")}
      </Text>

      {/* Directory */}
      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.directoryOptional")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="/path/to/project"
        placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
        value={directory}
        onChangeText={setDirectory}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={[styles.hint, isDark && styles.hintDark]}>{t("connection.add.advanced.directoryHint")}</Text>

      {/* Auth */}
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{t("connection.shared.authentication")}</Text>

      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.username")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="admin"
        placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.password")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="password"
        placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* Save */}
      <TouchableOpacity
        style={[styles.connectButton, isDark && styles.connectButtonDark, { marginTop: 32 }]}
        onPress={handleAdvancedSave}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color={isDark ? "#07080c" : "#ffffff"} />
        ) : (
          <Text style={[styles.connectButtonText, isDark && styles.connectButtonTextDark]}>
            {t("connection.add.advanced.saveButton")}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#07080c",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  // Quick connect styles
  quickHeader: {
    alignItems: "center",
    paddingVertical: 24,
  },
  quickTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#07080c",
    marginTop: 16,
  },
  quickSubtitle: {
    fontSize: 15,
    color: "#8a93a8",
    marginTop: 8,
    textAlign: "center",
  },
  ipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ipInput: {
    flex: 1,
  },
  ipColon: {
    fontSize: 20,
    fontWeight: "600",
    color: "#07080c",
  },
  portInput: {
    width: 80,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#07080c",
    marginTop: 24,
  },
  connectButtonDark: {
    backgroundColor: "#22d3ee",
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  connectButtonTextDark: {
    color: "#07080c",
  },
  helpBox: {
    backgroundColor: "#141926",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  helpBoxDark: {
    backgroundColor: "#0d1018",
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#07080c",
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: "#8a93a8",
    lineHeight: 20,
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#e5e5e5",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  usernameHint: {
    fontSize: 12,
    color: "#8a93a8",
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 18,
  },
  usernameHintLink: {
    color: "#0891b2",
    fontWeight: "600",
  },
  advancedLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 16,
    marginTop: 16,
  },
  advancedLinkText: {
    fontSize: 14,
    color: "#8a93a8",
  },
  backToQuick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  backToQuickText: {
    fontSize: 14,
    color: "#8a93a8",
  },
  // Original styles
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#07080c",
    marginTop: 16,
    marginBottom: 8,
  },
  labelDark: {
    color: "#ffffff",
  },
  typeContainer: {
    flexDirection: "row",
    gap: 8,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#141926",
    gap: 6,
  },
  typeOptionDark: {
    backgroundColor: "#0d1018",
  },
  typeOptionSelected: {
    backgroundColor: "#07080c",
  },
  typeOptionSelectedDark: {
    backgroundColor: "#22d3ee",
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8a93a8",
  },
  textDark: {
    color: "#ffffff",
  },
  typeLabelSelected: {
    color: "#ffffff",
  },
  typeLabelSelectedDark: {
    color: "#07080c",
  },
  hint: {
    fontSize: 13,
    color: "#8a93a8",
    marginTop: 8,
  },
  hintDark: {
    color: "#8a93a8",
  },
  input: {
    backgroundColor: "#141926",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#07080c",
  },
  inputDark: {
    backgroundColor: "#0d1018",
    color: "#ffffff",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#07080c",
    marginTop: 32,
    marginBottom: 8,
  },
  connectCard: {
    backgroundColor: "#141926",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#1c2333",
  },
  connectCardDark: {
    backgroundColor: "#0c1a26",
    borderColor: "#155e75",
  },
  connectCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  connectCardTitles: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  connectCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#07080c",
  },
  connectCardBadge: {
    backgroundColor: "#0891b2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  connectCardBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  connectCardDesc: {
    fontSize: 13,
    color: "#8a93a8",
    lineHeight: 20,
  },
  pairButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#0891b2",
    marginTop: 12,
  },
  pairButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
})
