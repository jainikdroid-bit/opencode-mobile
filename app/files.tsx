import { useCallback, useEffect, useMemo, useState } from "react"
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  BackHandler,
} from "react-native"
import { Stack, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import { useTranslation } from "react-i18next"
import { useConnections } from "../src/stores/connections"
import { listFiles, readFile, type RemoteEntry, type ServerConn } from "../src/lib/server-api"
import { sortEntries, parentPath, breadcrumbs, clipForView, numberLines } from "../src/lib/server-tools"

// Browse the project directory on the server and read text files. Read-only on purpose:
// editing is the agent's job; this screen is for checking what it did from the phone.
export default function FilesScreen() {
  const isDark = useColorScheme() === "dark"
  const { t } = useTranslation()
  const { directory } = useLocalSearchParams<{ directory?: string }>()
  const base = useConnections((s) => s.clientBase)

  const conn: ServerConn | null = useMemo(
    () => (base ? { baseUrl: base.baseUrl, auth: base.auth, directory: directory || undefined } : null),
    [base, directory],
  )

  const [path, setPath] = useState("")
  const [entries, setEntries] = useState<RemoteEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [open, setOpen] = useState<{ path: string; text?: string; binary?: boolean; clipped?: boolean } | null>(null)
  const [opening, setOpening] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(
    async (target: string) => {
      if (!conn) return
      setError(null)
      setEntries(null)
      try {
        setEntries(sortEntries(await listFiles(conn, target)))
        setPath(target)
        setFilter("")
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [conn],
  )

  useEffect(() => {
    void load("")
  }, [load])

  // Android back goes up one level (or closes the open file) before leaving the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (open) {
        setOpen(null)
        return true
      }
      if (path) {
        void load(parentPath(path))
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [open, path, load])

  const openFile = async (entry: RemoteEntry) => {
    if (!conn || opening) return
    setOpening(true)
    try {
      const file = await readFile(conn, entry.path)
      if (file.type === "binary") {
        setOpen({ path: entry.path, binary: true })
      } else {
        const clipped = clipForView(file.content)
        setOpen({ path: entry.path, text: clipped.text, clipped: clipped.clipped })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOpening(false)
    }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? (entries ?? []).filter((e) => e.name.toLowerCase().includes(q)) : (entries ?? [])
  }, [entries, filter])

  const copyContent = async () => {
    if (!open?.text) return
    await Clipboard.setStringAsync(open.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const subtle = [s.subtle, isDark && s.subtleDark]
  const title = open ? open.path.split("/").pop() || t("files.title") : t("files.title")

  return (
    <View style={[s.container, isDark && s.containerDark]} testID="files-screen">
      <Stack.Screen options={{ title, headerBackTitle: t("common.back") }} />

      {open ? (
        <FileViewer file={open} isDark={isDark} onCopy={copyContent} copied={copied} t={t} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.crumbs} contentContainerStyle={s.crumbsContent}>
            <TouchableOpacity onPress={() => void load("")} style={s.crumb} testID="crumb-root">
              <Ionicons name="home-outline" size={16} color={path ? "#0891b2" : isDark ? "#fff" : "#111"} />
            </TouchableOpacity>
            {breadcrumbs(path).map((c, i, all) => (
              <View key={c.path} style={s.crumbWrap}>
                <Ionicons name="chevron-forward" size={14} color="#999" />
                <TouchableOpacity onPress={() => void load(c.path)} style={s.crumb}>
                  <Text style={[s.crumbText, i === all.length - 1 ? (isDark ? s.textDark : s.textStrong) : s.crumbLink]}>{c.label}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TextInput
            style={[s.search, isDark && s.searchDark]}
            placeholder={t("files.filter")}
            placeholderTextColor={isDark ? "#666" : "#999"}
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? (
            <View style={s.center}>
              <Ionicons name="alert-circle-outline" size={40} color="#ff4d6d" />
              <Text style={[s.errorText, isDark && s.textDark]}>{error}</Text>
              <TouchableOpacity style={s.retry} onPress={() => void load(path)}>
                <Text style={s.retryText}>{t("common.retry")}</Text>
              </TouchableOpacity>
            </View>
          ) : entries === null ? (
            <ActivityIndicator style={s.spinner} />
          ) : (
            <FlatList
              data={visible}
              keyExtractor={(e) => e.path}
              ListHeaderComponent={
                path ? (
                  <TouchableOpacity style={[s.row, isDark && s.rowDark]} onPress={() => void load(parentPath(path))} testID="files-up">
                    <Ionicons name="arrow-up" size={20} color="#0891b2" />
                    <Text style={[s.rowName, { color: "#0891b2" }]}>{t("files.up")}</Text>
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={<Text style={[subtle, s.empty]}>{t("files.empty")}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.row, isDark && s.rowDark, item.ignored && s.ignored]}
                  onPress={() => (item.type === "directory" ? void load(item.path) : void openFile(item))}
                  testID={`file-row-${item.path}`}
                >
                  <Ionicons
                    name={item.type === "directory" ? "folder" : "document-text-outline"}
                    size={22}
                    color={item.type === "directory" ? "#ffb800" : isDark ? "#9ca3af" : "#6b7280"}
                  />
                  <Text style={[s.rowName, isDark && s.textDark]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.type === "directory" ? <Ionicons name="chevron-forward" size={16} color="#999" /> : null}
                </TouchableOpacity>
              )}
            />
          )}
          {opening ? <ActivityIndicator style={s.opening} /> : null}
        </>
      )}
    </View>
  )
}

function FileViewer({
  file,
  isDark,
  onCopy,
  copied,
  t,
}: {
  file: { path: string; text?: string; binary?: boolean; clipped?: boolean }
  isDark: boolean
  onCopy: () => void
  copied: boolean
  t: (key: string) => string
}) {
  const numbered = useMemo(() => (file.text !== undefined ? numberLines(file.text) : null), [file.text])
  return (
    <View style={s.viewer}>
      <View style={[s.viewerBar, isDark && s.viewerBarDark]}>
        <Text style={[s.viewerPath, isDark && s.textDark]} numberOfLines={1}>
          {file.path}
        </Text>
        {file.text !== undefined ? (
          <TouchableOpacity onPress={onCopy} style={s.copyBtn} testID="file-copy">
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color="#0891b2" />
            <Text style={s.copyText}>{copied ? t("files.copied") : t("files.copy")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {file.binary || !numbered ? (
        <View style={s.center}>
          <Ionicons name="cube-outline" size={40} color="#9ca3af" />
          <Text style={[s.errorText, isDark && s.textDark]}>{t("files.binary")}</Text>
        </View>
      ) : (
        <FlatList
          data={numbered.lines}
          keyExtractor={(_, i) => String(i)}
          initialNumToRender={40}
          windowSize={10}
          ListFooterComponent={file.clipped ? <Text style={[s.subtle, s.clipped]}>{t("files.clipped")}</Text> : null}
          renderItem={({ item, index }) => (
            <View style={s.codeRow}>
              <Text style={[s.lineNo, { minWidth: 10 + numbered.gutter * 8 }]}>{index + 1}</Text>
              <Text style={[s.code, isDark && s.codeDark]}>{item.length ? item : " "}</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  containerDark: { backgroundColor: "#07080c" },
  crumbs: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1c2333" },
  crumbsContent: { paddingHorizontal: 12, alignItems: "center", paddingVertical: 8 },
  crumbWrap: { flexDirection: "row", alignItems: "center" },
  crumb: { paddingHorizontal: 6, paddingVertical: 4 },
  crumbText: { fontSize: 14, fontWeight: "600" },
  crumbLink: { color: "#0891b2" },
  textStrong: { color: "#0a0d14" },
  textDark: { color: "#ffffff" },
  search: { margin: 12, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: "#141926", fontSize: 15, color: "#111" },
  searchDark: { backgroundColor: "#0d1018", color: "#fff" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1c2333" },
  rowDark: { borderBottomColor: "#161c2a" },
  rowName: { flex: 1, fontSize: 16, color: "#0a0d14" },
  ignored: { opacity: 0.45 },
  subtle: { color: "#8a93a8" },
  subtleDark: { color: "#8a93a8" },
  empty: { textAlign: "center", paddingVertical: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorText: { fontSize: 14, textAlign: "center", color: "#444" },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: "#0891b2" },
  retryText: { color: "#fff", fontWeight: "600" },
  spinner: { marginTop: 40 },
  opening: { position: "absolute", top: "50%", alignSelf: "center" },
  viewer: { flex: 1 },
  viewerBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#141926" },
  viewerBarDark: { backgroundColor: "#0d1018" },
  viewerPath: { flex: 1, fontSize: 12, color: "#555", fontFamily: "monospace" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  copyText: { fontSize: 13, color: "#0891b2", fontWeight: "600" },
  codeRow: { flexDirection: "row", paddingRight: 12 },
  lineNo: { textAlign: "right", paddingRight: 10, fontSize: 12, lineHeight: 18, color: "#9ca3af", fontFamily: "monospace" },
  code: { flex: 1, fontSize: 12, lineHeight: 18, color: "#111827", fontFamily: "monospace" },
  codeDark: { color: "#e5e7eb" },
  clipped: { textAlign: "center", paddingVertical: 16 },
})
