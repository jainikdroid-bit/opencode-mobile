import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, useColorScheme, ActivityIndicator, Alert } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Stack, useLocalSearchParams } from "expo-router"
import { WebView, type WebViewMessageEvent } from "react-native-webview"
import * as Clipboard from "expo-clipboard"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../src/stores/connections"
import { createPty, removePty, resizePty, ptySocket, type ServerConn } from "../src/lib/server-api"
import { applyCtrl, diffInput, isControlFrame, SPECIAL_KEYS } from "../src/lib/server-tools"
import { TERMINAL_HTML } from "../src/lib/terminal-html"

type Status = "connecting" | "connected" | "closed" | "error"

const KEY_BUTTONS: Array<{ label: string; send: string; testID: string }> = [
  { label: "Esc", send: SPECIAL_KEYS.esc, testID: "key-esc" },
  { label: "Tab", send: SPECIAL_KEYS.tab, testID: "key-tab" },
  { label: "↑", send: SPECIAL_KEYS.up, testID: "key-up" },
  { label: "↓", send: SPECIAL_KEYS.down, testID: "key-down" },
  { label: "←", send: SPECIAL_KEYS.left, testID: "key-left" },
  { label: "→", send: SPECIAL_KEYS.right, testID: "key-right" },
  { label: "|", send: "|", testID: "key-pipe" },
  { label: "/", send: "/", testID: "key-slash" },
  { label: "-", send: "-", testID: "key-dash" },
  { label: "~", send: "~", testID: "key-tilde" },
  { label: "Home", send: SPECIAL_KEYS.home, testID: "key-home" },
  { label: "End", send: SPECIAL_KEYS.end, testID: "key-end" },
]

// A real shell on the computer (a PTY on the opencode server) rendered with xterm.js in a
// WebView. The WebSocket lives here in React Native, not in the page, because React Native can
// send the Basic-auth header that the server requires and a page cannot.
export default function TerminalScreen() {
  const isDark = useColorScheme() === "dark"
  const { t } = useTranslation()
  const { directory } = useLocalSearchParams<{ directory?: string }>()
  const base = useConnections((s) => s.clientBase)
  const conn: ServerConn | null = useMemo(
    () => (base ? { baseUrl: base.baseUrl, auth: base.auth, directory: directory || undefined } : null),
    [base, directory],
  )

  const insets = useSafeAreaInsets()
  const inputRef = useRef<TextInput>(null)
  const typed = useRef("")
  const [line, setLine] = useState("")
  const web = useRef<WebView>(null)
  const socket = useRef<WebSocket | null>(null)
  const ptyId = useRef<string | null>(null)
  const pageReady = useRef(false)
  const outBuffer = useRef("")
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const size = useRef({ cols: 80, rows: 24 })
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<Status>("connecting")
  const [detail, setDetail] = useState<string>("")
  const [ctrl, setCtrl] = useState(false)
  const ctrlRef = useRef(false)
  ctrlRef.current = ctrl

  const run = useCallback((js: string) => web.current?.injectJavaScript(`${js};true;`), [])

  // Terminal output arrives in bursts; batch it so the WebView is not flooded with calls.
  const flushOutput = useCallback(() => {
    flushTimer.current = null
    if (!pageReady.current || !outBuffer.current) return
    const chunk = outBuffer.current
    outBuffer.current = ""
    run(`window.termWrite(${JSON.stringify(chunk)})`)
  }, [run])

  const pushOutput = useCallback(
    (text: string) => {
      outBuffer.current += text
      if (!flushTimer.current) flushTimer.current = setTimeout(flushOutput, 25)
    },
    [flushOutput],
  )

  const send = useCallback((data: string) => {
    if (socket.current?.readyState === 1) socket.current.send(data)
  }, [])

  const syncSize = useCallback(() => {
    if (!conn || !ptyId.current) return
    if (resizeTimer.current) clearTimeout(resizeTimer.current)
    resizeTimer.current = setTimeout(() => {
      if (conn && ptyId.current) void resizePty(conn, ptyId.current, size.current.cols, size.current.rows).catch(() => {})
    }, 150)
  }, [conn])

  const connect = useCallback(
    async (existing?: string | null) => {
      if (!conn) return
      setStatus("connecting")
      setDetail("")
      try {
        const id = existing ?? (await createPty(conn, { title: "Phone" })).id
        ptyId.current = id
        const target = await ptySocket(conn, id)
        // React Native's WebSocket takes a third "options" argument with request headers
        // (not in the DOM typings), which is how the Basic-auth header reaches the server.
        const WS = WebSocket as unknown as new (url: string, protocols?: string[] | null, options?: { headers: Record<string, string> }) => WebSocket
        const ws = new WS(target.url, undefined, { headers: target.headers })
        socket.current = ws
        ws.onopen = () => {
          setStatus("connected")
          syncSize()
        }
        ws.onmessage = (event) => {
          const data = typeof event.data === "string" ? event.data : ""
          if (data && !isControlFrame(data)) pushOutput(data)
        }
        ws.onerror = () => {
          setStatus("error")
          setDetail(t("terminal.connectionFailed"))
        }
        ws.onclose = () => setStatus((current) => (current === "error" ? current : "closed"))
      } catch (e) {
        setStatus("error")
        setDetail(e instanceof Error ? e.message : String(e))
      }
    },
    [conn, pushOutput, syncSize, t],
  )

  useEffect(() => {
    void connect()
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
      if (resizeTimer.current) clearTimeout(resizeTimer.current)
      socket.current?.close()
      const id = ptyId.current
      if (conn && id) void removePty(conn, id).catch(() => {})
    }
    // Connect once per screen; conn identity is stable for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { t: string; d?: string; cols?: number; rows?: number }
    try {
      message = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (message.t === "ready") {
      pageReady.current = true
      flushOutput()
    } else if (message.t === "resize" && message.cols && message.rows) {
      size.current = { cols: message.cols, rows: message.rows }
      syncSize()
    }
  }

  // The text field drives the shell line live: every change is sent as the difference from
  // the previous value, so any keyboard (and IME composition) behaves, and tab completion works.
  const onLineChange = (next: string) => {
    let delta = diffInput(typed.current, next)
    if (ctrlRef.current && next.length > typed.current.length && delta.length === 1) {
      delta = applyCtrl(delta)
      setCtrl(false)
      typed.current = next.slice(0, -1) // the Ctrl character is not part of the visible line
      setLine(typed.current)
      send(delta)
      return
    }
    typed.current = next
    setLine(next)
    if (delta) send(delta)
  }

  const submitLine = () => {
    send(String.fromCharCode(13))
    typed.current = ""
    setLine("")
    inputRef.current?.focus()
  }

  const sendKey = (data: string) => {
    send(data)
    inputRef.current?.focus()
  }

  const paste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => "")
    if (text) {
      send(text)
      typed.current += text
      setLine(typed.current)
    }
    inputRef.current?.focus()
  }

  const reconnect = () => {
    Alert.alert(t("terminal.reconnectTitle"), t("terminal.reconnectMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("terminal.reconnect"), onPress: () => void connect(null) },
    ])
  }

  const dot = status === "connected" ? "#34f5a5" : status === "connecting" ? "#ffb800" : "#ff4d6d"

  return (
    <View style={[s.container, isDark && s.containerDark]} testID="terminal-screen">
      <Stack.Screen options={{ title: t("terminal.title") }} />
      <View style={[s.statusBar, isDark && s.statusBarDark]}>
        <View style={[s.dot, { backgroundColor: dot }]} />
        <Text style={[s.statusText, isDark && s.textDark]} numberOfLines={1}>
          {t(`terminal.status.${status}`)}
          {detail ? ` · ${detail}` : ""}
        </Text>
        {status === "closed" || status === "error" ? (
          <TouchableOpacity onPress={reconnect} testID="terminal-reconnect">
            <Text style={s.reconnect}>{t("terminal.reconnect")}</Text>
          </TouchableOpacity>
        ) : null}
        {status === "connecting" ? <ActivityIndicator size="small" /> : null}
      </View>

      <WebView
        ref={web}
        style={s.web}
        originWhitelist={["*"]}
        source={{ html: TERMINAL_HTML }}
        javaScriptEnabled
        onMessage={onMessage}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        overScrollMode="never"
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        testID="terminal-webview"
      />

      <View style={s.inputRow}>
        <Text style={s.prompt}>$</Text>
        <TextInput
          ref={inputRef}
          style={s.input}
          value={line}
          onChangeText={onLineChange}
          onSubmitEditing={submitLine}
          blurOnSubmit={false}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="send"
          placeholder={t("terminal.placeholder")}
          placeholderTextColor="#6b7280"
          testID="terminal-input"
        />
        <TouchableOpacity style={s.enter} onPress={submitLine} testID="terminal-enter">
          <Ionicons name="return-down-back" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={[s.keys, isDark && s.keysDark, { paddingBottom: Math.max(insets.bottom, 4) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={s.keysContent}>
          <TouchableOpacity style={[s.key, ctrl && s.keyActive]} onPress={() => setCtrl((c) => !c)} testID="key-ctrl">
            <Text style={[s.keyText, ctrl && s.keyTextActive]}>Ctrl</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.key} onPress={() => sendKey("\u0003")} testID="key-ctrl-c">
            <Text style={s.keyText}>^C</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.key} onPress={() => sendKey("\u0004")} testID="key-ctrl-d">
            <Text style={s.keyText}>^D</Text>
          </TouchableOpacity>
          {KEY_BUTTONS.map((k) => (
            <TouchableOpacity key={k.testID} style={s.key} onPress={() => sendKey(k.send)} testID={k.testID}>
              <Text style={s.keyText}>{k.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.key} onPress={() => void paste()} testID="key-paste">
            <Ionicons name="clipboard-outline" size={16} color="#e5e7eb" />
          </TouchableOpacity>
          <TouchableOpacity style={s.key} onPress={() => run("window.termClear()")} testID="key-clear">
            <Ionicons name="trash-outline" size={16} color="#e5e7eb" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07080c" },
  containerDark: { backgroundColor: "#07080c" },
  statusBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#141926" },
  statusBarDark: { backgroundColor: "#0d1018" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 12, color: "#444" },
  textDark: { color: "#d1d5db" },
  reconnect: { color: "#0891b2", fontWeight: "600", fontSize: 13 },
  web: { flex: 1, backgroundColor: "#07080c" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#0d1018", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#1c2333" },
  prompt: { color: "#22d3ee", fontSize: 16, fontWeight: "700", fontFamily: "monospace" },
  input: { flex: 1, height: 40, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#07080c", color: "#e5e7eb", fontSize: 15, fontFamily: "monospace" },
  enter: { width: 44, height: 40, borderRadius: 8, backgroundColor: "#0891b2", alignItems: "center", justifyContent: "center" },
  keys: { backgroundColor: "#0d1018", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#1c2333" },
  keysDark: { backgroundColor: "#0d1018" },
  keysContent: { paddingHorizontal: 8, paddingVertical: 6, gap: 6, alignItems: "center" },
  key: { minWidth: 42, height: 36, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#141926", alignItems: "center", justifyContent: "center" },
  keyActive: { backgroundColor: "#0891b2" },
  keyText: { color: "#e5e7eb", fontSize: 14, fontWeight: "600" },
  keyTextActive: { color: "#ffffff" },
})
