import { useCallback, useEffect, useMemo, useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native"
import { router, useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as SecureStore from "expo-secure-store"
import { useTranslation } from "react-i18next"
import { cyber } from "../src/theme/cyber"
import { useConnections } from "../src/stores/connections"
import { AcpApiError, listAgents, type AgentInfo, type RunningAgent } from "../src/lib/acp/api"

const FOLDER_KEY = "acp_last_folder"

// Other coding agents on the computer: the ones installed there (Claude Code, Codex, Gemini CLI, Goose, ...),
// and the ones already running, which can be reopened where they were left.
export default function AgentsScreen() {
  const { t } = useTranslation()
  const { activeConnection, clientBase } = useConnections()
  const target = useMemo(
    () =>
      activeConnection?.launcherPort
        ? { serverUrl: activeConnection.url, launcherPort: activeConnection.launcherPort, auth: clientBase?.auth, tunnel: !!activeConnection.tunnelTopic }
        : null,
    [activeConnection, clientBase],
  )
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [running, setRunning] = useState<RunningAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<string | null>(null)
  const [folder, setFolder] = useState("")

  const load = useCallback(async () => {
    if (!target) return
    setLoading(true)
    setProblem(null)
    try {
      const result = await listAgents(target)
      setAgents(result.agents.filter((a) => a.installed))
      setRunning(result.running.filter((r) => !r.exited))
    } catch (error) {
      setProblem(error instanceof AcpApiError && error.outdated ? t("acp.outdated") : t("acp.unreachable"))
    } finally {
      setLoading(false)
    }
  }, [target, t])

  // Every time the screen comes back to the front (from a chat, say): the running list may have changed.
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )
  useEffect(() => {
    SecureStore.getItemAsync(FOLDER_KEY).then((saved) => saved && setFolder(saved)).catch(() => undefined)
  }, [])

  const open = (agent: AgentInfo) => {
    const cwd = folder.trim()
    void SecureStore.setItemAsync(FOLDER_KEY, cwd).catch(() => undefined)
    router.push({ pathname: "/agent-chat", params: { agent: agent.id, name: agent.name, cwd } })
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" testID="agents-screen">
      <Text style={s.body}>{t("acp.intro")}</Text>

      {running.length > 0 ? (
        <>
          <Text style={s.section}>{t("acp.running")}</Text>
          {running.map((r) => (
            <TouchableOpacity key={r.id} style={s.card} onPress={() => router.push({ pathname: "/agent-chat", params: { agent: r.agent, name: r.name, cwd: r.cwd, id: r.id } })} testID="acp-running">
              <Ionicons name="pulse-outline" size={20} color={cyber.green} />
              <View style={s.cardText}>
                <Text style={s.cardTitle}>{r.name}</Text>
                <Text style={s.cardSub} numberOfLines={1}>{r.cwd}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={cyber.muted} />
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <Text style={s.section}>{t("acp.folderLabel")}</Text>
      <TextInput style={s.input} value={folder} onChangeText={setFolder} placeholder={t("acp.folderHint")} placeholderTextColor={cyber.muted} autoCapitalize="none" autoCorrect={false} testID="acp-folder" />

      <View style={s.sectionRow}>
        <Text style={s.section}>{t("acp.installed")}</Text>
        {loading ? <ActivityIndicator size="small" color={cyber.cyan} /> : (
          <TouchableOpacity onPress={() => void load()} testID="acp-refresh"><Text style={s.link}>{t("acp.refresh")}</Text></TouchableOpacity>
        )}
      </View>
      {problem ? <Text style={s.problem}>{problem}</Text> : null}
      {!problem && !loading && agents.length === 0 ? <Text style={s.body}>{t("acp.none")}</Text> : null}
      {agents.map((agent) => (
        <TouchableOpacity key={agent.id} style={s.card} onPress={() => open(agent)} testID={`acp-agent-${agent.id}`}>
          <Ionicons name="sparkles-outline" size={20} color={cyber.cyan} />
          <View style={s.cardText}><Text style={s.cardTitle}>{agent.name}</Text></View>
          <Text style={s.start}>{t("acp.start")}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: cyber.bg },
  content: { padding: 20, gap: 10 },
  body: { color: cyber.muted, fontSize: 14, lineHeight: 20 },
  problem: { color: cyber.red, fontSize: 14, lineHeight: 20 },
  section: { color: cyber.text, fontSize: 13, fontWeight: "600", marginTop: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  link: { color: cyber.cyan, fontSize: 14 },
  input: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: cyber.border, backgroundColor: cyber.surface, color: cyber.text, paddingHorizontal: 14, fontSize: 15 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: cyber.border, backgroundColor: cyber.surface },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { color: cyber.text, fontSize: 15, fontWeight: "600" },
  cardSub: { color: cyber.muted, fontSize: 12, fontFamily: cyber.mono },
  start: { color: cyber.cyan, fontSize: 14, fontWeight: "600" },
})
