import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from "react-native"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Clipboard from "expo-clipboard"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { Mascot, type MascotState } from "../src/components/Mascot"
import { cyber } from "../src/theme/cyber"
import {
  GUIDE_DONE_KEY,
  GUIDE_DOC_URL,
  GUIDE_STEPS,
  TAILSCALE_STORE_URL,
  clampStep,
  commandFor,
  isLastStep,
  type GuideOs,
} from "../src/lib/guide"

const MOOD: MascotState[] = ["working", "thinking", "idle"]

// A three-step setup guide: computer command, Tailscale on the phone, scan. It opens by itself once for
// someone with no server (see app/(tabs)/index.tsx) and can be skipped at any moment; "Skip guide" and
// finishing both remember the choice so it never nags again. It stays reachable from the empty screen.
export default function GuideScreen() {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [os, setOs] = useState<GuideOs>("windows")
  const [copied, setCopied] = useState(false)
  const step = GUIDE_STEPS[clampStep(index)]

  const finish = async (then?: () => void) => {
    await AsyncStorage.setItem(GUIDE_DONE_KEY, "1").catch(() => {})
    if (then) then()
    else router.canGoBack() ? router.back() : router.replace("/")
  }

  const copyCommand = async () => {
    await Clipboard.setStringAsync(commandFor(os))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const next = () => {
    if (step === "scan") void finish(() => router.replace("/scan"))
    else setIndex((i) => clampStep(i + 1))
  }

  return (
    <View style={s.container} testID="guide-screen">
      <View style={s.top}>
        <Text style={s.counter}>{`${index + 1} / ${GUIDE_STEPS.length}`}</Text>
        <TouchableOpacity onPress={() => void finish()} hitSlop={10} testID="guide-skip">
          <Text style={s.skip}>{t("guide.skip")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Mascot state={MOOD[clampStep(index)]} size={104} />
        <View style={s.dots}>
          {GUIDE_STEPS.map((name, i) => (
            <View key={name} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>
        <Text style={s.title}>{t(`guide.${step}.title`)}</Text>
        <Text style={s.body}>{t(`guide.${step}.body`)}</Text>

        {step === "computer" ? (
          <View style={s.commandBox}>
            <View style={s.tabs}>
              {(["windows", "unix"] as const).map((key) => (
                <TouchableOpacity key={key} onPress={() => setOs(key)} style={[s.tab, os === key && s.tabActive]} testID={`guide-os-${key}`}>
                  <Text style={[s.tabText, os === key && s.tabTextActive]}>{t(`guide.os.${key}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.command} selectable>
              {commandFor(os)}
            </Text>
            <TouchableOpacity style={s.copy} onPress={() => void copyCommand()} testID="guide-copy">
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={cyber.bg} />
              <Text style={s.copyText}>{copied ? t("guide.copied") : t("guide.copy")}</Text>
            </TouchableOpacity>
            <Text style={s.tip}>{t("guide.computer.tip")}</Text>
          </View>
        ) : null}

        {step === "tailscale" ? (
          <TouchableOpacity style={s.secondary} onPress={() => void Linking.openURL(TAILSCALE_STORE_URL)} testID="guide-play">
            <Ionicons name="logo-google-playstore" size={18} color={cyber.cyan} />
            <Text style={s.secondaryText}>{t("guide.tailscale.open")}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={() => void Linking.openURL(GUIDE_DOC_URL)} style={s.docLink}>
          <Text style={s.docLinkText}>{t("guide.fullGuide")}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={s.bottom}>
        {index > 0 ? (
          <TouchableOpacity style={s.back} onPress={() => setIndex((i) => clampStep(i - 1))} testID="guide-back">
            <Text style={s.backText}>{t("guide.back")}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.back} />
        )}
        <TouchableOpacity style={s.primary} onPress={next} testID="guide-next">
          <Text style={s.primaryText}>{isLastStep(index) ? t("guide.scanNow") : t("guide.next")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: cyber.bg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 14 },
  counter: { color: cyber.muted, fontFamily: cyber.mono, fontSize: 13 },
  skip: { color: cyber.cyan, fontSize: 15, fontWeight: "600" },
  content: { alignItems: "center", paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 12 },
  dots: { flexDirection: "row", gap: 8, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: cyber.border },
  dotActive: { backgroundColor: cyber.cyan, width: 22 },
  title: { color: cyber.text, fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 8 },
  body: { color: cyber.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  commandBox: { alignSelf: "stretch", backgroundColor: cyber.surface, borderRadius: 8, borderWidth: 1, borderColor: cyber.borderGlow, padding: 12, gap: 10, marginTop: 6 },
  tabs: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: cyber.border },
  tabActive: { backgroundColor: cyber.cyan, borderColor: cyber.cyan },
  tabText: { color: cyber.muted, fontSize: 12 },
  tabTextActive: { color: cyber.bg, fontWeight: "700" },
  command: { color: cyber.green, fontFamily: cyber.mono, fontSize: 12, lineHeight: 18 },
  copy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: cyber.cyan, borderRadius: 8, height: 42 },
  copyText: { color: cyber.bg, fontWeight: "700", fontSize: 14 },
  tip: { color: cyber.muted, fontSize: 12, lineHeight: 17 },
  secondary: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: cyber.cyan, borderRadius: 8, paddingHorizontal: 16, height: 46, marginTop: 6 },
  secondaryText: { color: cyber.cyan, fontSize: 15, fontWeight: "600" },
  docLink: { paddingVertical: 10 },
  docLinkText: { color: cyber.muted, fontSize: 12, textDecorationLine: "underline" },
  bottom: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 22, paddingTop: 8 },
  back: { width: 80, alignItems: "center", justifyContent: "center", height: 52 },
  backText: { color: cyber.muted, fontSize: 15 },
  primary: { flex: 1, height: 52, borderRadius: 8, backgroundColor: cyber.cyan, alignItems: "center", justifyContent: "center" },
  primaryText: { color: cyber.bg, fontSize: 16, fontWeight: "700" },
})
