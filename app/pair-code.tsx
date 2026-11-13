import { useCallback, useEffect, useRef, useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { cyber } from "../src/theme/cyber"
import { CODE_LENGTH, formatCode, isCompleteCode, normalizeCode, parsePairAddress, type PairTarget } from "../src/lib/pair-code"
import { exchangeCode, findComputers, type FoundComputer } from "../src/lib/pair-code-api"
import { isTailnetHost } from "../src/lib/tailnet-host"
import { useTailnet } from "../src/stores/tailnet"

const TAILNET_SIGN_IN_WAIT_MS = 5 * 60_000
const keyOf = (c: PairTarget) => `${c.host}:${c.port}`

// Pairing without a camera: the installer on the computer shows six digits. The app looks for the computer
// (home network and built-in Tailscale), the person types the code, and the computer hands over the same
// details a QR code carries. Those go to the usual confirmation screen: nothing is added from here.
export default function PairCodeScreen() {
  const { t } = useTranslation()
  const tailnet = useTailnet()
  const [found, setFound] = useState<FoundComputer[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [address, setAddress] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [waitingTailnet, setWaitingTailnet] = useState(false)
  const run = useRef(0)

  const search = useCallback(async () => {
    const mine = ++run.current
    setFound([])
    setSearching(true)
    await findComputers(
      (computer) => setFound((list) => (list.some((c) => keyOf(c) === keyOf(computer)) ? list : [...list, computer])),
      () => run.current !== mine,
    ).catch(() => undefined)
    if (run.current === mine) setSearching(false)
  }, [])

  useEffect(() => {
    void search()
    return () => {
      run.current++
    }
  }, [search])

  // One computer found and nothing chosen yet: that is the one.
  useEffect(() => {
    if (found.length === 1 && !selected) setSelected(keyOf(found[0]))
  }, [found, selected])

  const target = (): PairTarget | null => {
    if (address.trim()) return parsePairAddress(address)
    return found.find((c) => keyOf(c) === selected) ?? null
  }

  const useBuiltInTailscale = async (): Promise<boolean> => {
    setWaitingTailnet(true)
    await tailnet.setEnabled(true)
    const ready = await useTailnet.getState().waitReady(TAILNET_SIGN_IN_WAIT_MS)
    setWaitingTailnet(false)
    if (!ready) Alert.alert(t("connection.pair.failedTitle"), t("tailnet.notConnected"))
    return ready
  }

  const submit = async () => {
    if (busy) return
    const where = target()
    if (!where) return Alert.alert(t("pairCode.title"), t("pairCode.needTarget"))
    if (!isCompleteCode(code)) return Alert.alert(t("pairCode.title"), t("pairCode.needCode"))
    setBusy(true)
    const outcome = await exchangeCode(where, code)
    setBusy(false)
    if (outcome.kind === "ok") {
      router.replace({
        pathname: "/connect",
        params: { url: outcome.url, password: outcome.password, name: outcome.name, launcher: String(outcome.launcherPort), topic: "" },
      })
      return
    }
    if (outcome.kind === "wrong") {
      setCode("")
      return Alert.alert(t("pairCode.title"), outcome.left > 0 ? t("pairCode.wrong", { left: outcome.left }) : t("pairCode.burned"))
    }
    if (outcome.kind === "inactive") return Alert.alert(t("pairCode.title"), t("pairCode.inactive"))
    const state = useTailnet.getState()
    // A tailnet address the phone cannot reach: usually the Tailscale app is off because another VPN is on.
    if (isTailnetHost(where.host) && state.available && !state.status?.ready) {
      return Alert.alert(t("connection.pair.failedTitle"), `${where.host}\n${t("tailnet.offer")}`, [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("tailnet.useBuiltIn"), onPress: () => void useBuiltInTailscale().then((ready) => (ready ? submit() : undefined)) },
      ])
    }
    Alert.alert(t("connection.pair.failedTitle"), t("pairCode.unreachable", { address: where.host }))
  }

  if (waitingTailnet) {
    return (
      <View style={[s.container, s.center]} testID="pair-code-tailnet-wait">
        <ActivityIndicator size="large" color={cyber.cyan} />
        <Text style={s.title}>{t("tailnet.waitTitle")}</Text>
        <Text style={s.body}>{t("tailnet.waitBody")}</Text>
        <TouchableOpacity style={s.link} onPress={() => void useTailnet.getState().signIn()}>
          <Text style={s.linkText}>{t("tailnet.signIn")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.link} onPress={() => void useTailnet.getState().setEnabled(false)}>
          <Text style={s.linkText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const canOfferTailnet = tailnet.available && !tailnet.status?.ready

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" testID="pair-code-screen">
      <Text style={s.body}>{t("pairCode.intro")}</Text>

      <View style={s.sectionRow}>
        <Text style={s.section}>{t("pairCode.computers")}</Text>
        {searching ? (
          <ActivityIndicator size="small" color={cyber.cyan} />
        ) : (
          <TouchableOpacity onPress={() => void search()} testID="pair-code-search">
            <Text style={s.linkText}>{t("pairCode.searchAgain")}</Text>
          </TouchableOpacity>
        )}
      </View>
      {found.map((computer) => {
        const active = !address.trim() && selected === keyOf(computer)
        return (
          <TouchableOpacity
            key={keyOf(computer)}
            style={[s.computer, active && s.computerActive]}
            onPress={() => {
              setAddress("")
              setSelected(keyOf(computer))
            }}
            testID="pair-code-computer"
          >
            <Ionicons name="desktop-outline" size={20} color={active ? cyber.cyan : cyber.muted} />
            <View style={s.computerText}>
              <Text style={s.computerName}>{computer.name}</Text>
              <Text style={s.computerHost}>{computer.host}</Text>
            </View>
            {active ? <Ionicons name="checkmark-circle" size={20} color={cyber.cyan} /> : null}
          </TouchableOpacity>
        )
      })}
      {found.length === 0 ? <Text style={s.hint}>{searching ? t("pairCode.searching") : t("pairCode.none")}</Text> : null}
      {canOfferTailnet ? (
        <TouchableOpacity style={s.link} onPress={() => void useBuiltInTailscale().then((ready) => (ready ? search() : undefined))} testID="pair-code-tailnet">
          <Text style={s.linkText}>{t("pairCode.searchTailnet")}</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={s.section}>{t("pairCode.addressLabel")}</Text>
      <TextInput
        style={s.input}
        value={address}
        onChangeText={setAddress}
        placeholder="192.168.1.20"
        placeholderTextColor={cyber.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        testID="pair-code-address"
      />

      <Text style={s.section}>{t("pairCode.codeLabel")}</Text>
      <TextInput
        style={[s.input, s.code]}
        value={formatCode(code)}
        onChangeText={(text) => setCode(normalizeCode(text))}
        placeholder="000 000"
        placeholderTextColor={cyber.border}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH + 1}
        testID="pair-code-input"
      />

      <TouchableOpacity style={[s.primary, busy && s.primaryBusy]} onPress={() => void submit()} disabled={busy} testID="pair-code-submit">
        {busy ? <ActivityIndicator color={cyber.bg} /> : <Text style={s.primaryText}>{t("connection.pair.connect")}</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: cyber.bg },
  content: { padding: 20, gap: 10 },
  center: { alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  title: { color: cyber.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { color: cyber.muted, fontSize: 14, lineHeight: 20 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  section: { color: cyber.text, fontSize: 13, fontWeight: "600", marginTop: 10 },
  hint: { color: cyber.muted, fontSize: 13 },
  computer: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: cyber.border, backgroundColor: cyber.surface },
  computerActive: { borderColor: cyber.cyan },
  computerText: { flex: 1, gap: 2 },
  computerName: { color: cyber.text, fontSize: 15, fontWeight: "600" },
  computerHost: { color: cyber.muted, fontSize: 12, fontFamily: cyber.mono },
  input: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: cyber.border, backgroundColor: cyber.surface, color: cyber.text, paddingHorizontal: 14, fontSize: 15 },
  code: { height: 64, fontSize: 30, letterSpacing: 6, textAlign: "center", fontFamily: cyber.mono },
  primary: { height: 52, borderRadius: 10, backgroundColor: cyber.cyan, alignItems: "center", justifyContent: "center", marginTop: 14 },
  primaryBusy: { opacity: 0.6 },
  primaryText: { color: cyber.bg, fontSize: 16, fontWeight: "700" },
  link: { paddingVertical: 8 },
  linkText: { color: cyber.cyan, fontSize: 14 },
})
