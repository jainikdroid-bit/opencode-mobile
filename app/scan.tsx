import { useRef, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native"
import { router } from "expo-router"
import { CameraView, useCameraPermissions } from "expo-camera"
import * as Clipboard from "expo-clipboard"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { Mascot } from "../src/components/Mascot"
import { parsePairingLink } from "../src/lib/pairing"
import { cyber } from "../src/theme/cyber"

// Pairing in one scan: point the camera at the QR code that tools/opencode-connect.ps1 shows on the
// computer. A valid code goes straight to the confirmation screen; nothing is added before the user
// confirms there. The phone's own camera app works too, but many camera apps ignore custom-scheme
// links, so this in-app scanner is the dependable path.
export default function ScanScreen() {
  const { t } = useTranslation()
  const [permission, requestPermission] = useCameraPermissions()
  const handled = useRef(false)
  const [message, setMessage] = useState<string | null>(null)

  const accept = (raw: string): boolean => {
    const pairing = parsePairingLink(raw)
    if (!pairing) return false
    handled.current = true
    router.replace({
      pathname: "/connect",
      params: { url: pairing.url, password: pairing.password ?? "", name: pairing.name, launcher: pairing.launcherPort ? String(pairing.launcherPort) : "", topic: pairing.tunnelTopic ?? "" },
    })
    return true
  }

  const onScanned = ({ data }: { data: string }) => {
    if (handled.current) return
    if (!accept(data)) setMessage(t("scan.invalid"))
  }

  const pasteLink = async () => {
    const text = await Clipboard.getStringAsync().catch(() => "")
    if (!accept(text)) Alert.alert(t("connection.pair.invalidTitle"), t("connection.pair.clipboardEmpty"))
  }

  if (!permission) return <View style={s.container} />

  if (!permission.granted) {
    return (
      <View style={[s.container, s.center]} testID="scan-permission">
        <Mascot state="idle" size={96} />
        <Text style={s.title}>{t("scan.permissionTitle")}</Text>
        <Text style={s.body}>{t("scan.permissionBody")}</Text>
        <TouchableOpacity style={s.primary} onPress={() => void requestPermission()} testID="scan-allow">
          <Text style={s.primaryText}>{t("scan.allow")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/pair-code")} style={s.link} testID="scan-code-fallback">
          <Text style={s.linkText}>{t("pairCode.button")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void pasteLink()} style={s.link}>
          <Text style={s.linkText}>{t("connection.pair.pasteButton")}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container} testID="scan-screen">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />
      <View style={s.overlay} pointerEvents="box-none">
        <Text style={s.hint}>{t("scan.hint")}</Text>
        <View style={s.frame}>
          <View style={[s.corner, s.tl]} />
          <View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} />
          <View style={[s.corner, s.br]} />
        </View>
        <Text style={[s.hint, message ? s.warn : null]}>{message ?? t("scan.sub")}</Text>
        <TouchableOpacity onPress={() => router.replace("/pair-code")} style={s.pill} testID="scan-code">
          <Ionicons name="keypad-outline" size={16} color={cyber.cyan} />
          <Text style={s.pillText}>{t("pairCode.button")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void pasteLink()} style={s.pill} testID="scan-paste">
          <Ionicons name="clipboard-outline" size={16} color={cyber.cyan} />
          <Text style={s.pillText}>{t("connection.pair.pasteButton")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const FRAME = 240
const BRACKET = 34

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: cyber.bg },
  center: { alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  title: { color: cyber.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { color: cyber.muted, fontSize: 14, textAlign: "center" },
  primary: { alignSelf: "stretch", height: 52, borderRadius: 8, backgroundColor: cyber.cyan, alignItems: "center", justifyContent: "center" },
  primaryText: { color: cyber.bg, fontSize: 16, fontWeight: "700" },
  link: { padding: 10 },
  linkText: { color: cyber.cyan, fontSize: 14 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: "rgba(7,8,12,0.35)" },
  hint: { color: cyber.text, fontFamily: cyber.mono, fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
  warn: { color: cyber.amber },
  frame: { width: FRAME, height: FRAME },
  corner: { position: "absolute", width: BRACKET, height: BRACKET, borderColor: cyber.cyan },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: cyber.borderGlow, backgroundColor: "rgba(13,16,24,0.85)" },
  pillText: { color: cyber.cyan, fontSize: 13 },
})
