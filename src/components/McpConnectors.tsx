import { useCallback, useEffect, useState } from "react"
import { View, Text, Switch, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native"
import { useTranslation } from "react-i18next"
import { useConnections } from "../stores/connections"
import { toMcpRows, isOn, type McpRow } from "../lib/mcp-status"

// Lists the active server's MCP connectors (mail, browser, phone, ...) with an
// on/off switch each, so they can be enabled from the phone instead of editing
// the server's config. Uses GET /mcp and POST /mcp/{name}/connect|disconnect.
export function McpConnectors({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation()
  const client = useConnections((s) => s.client)
  const [rows, setRows] = useState<McpRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!client) {
      setRows([])
      return
    }
    try {
      setRows(toMcpRows(await client.mcp.status()))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows((current) => current ?? [])
    }
  }, [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggle = async (row: McpRow, on: boolean) => {
    if (!client || busy) return
    setBusy(row.name)
    try {
      if (on) await client.mcp.connect(row.name)
      else await client.mcp.disconnect(row.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    await refresh()
    setBusy(null)
  }

  const label = (row: McpRow) => t(`settings.mcp.state.${row.state}`)
  const text = [styles.name, isDark && styles.textDark]
  const hint = [styles.hint, isDark && styles.hintDark]

  return (
    <View testID="mcp-connectors">
      <Text style={hint}>{t("settings.mcp.description")}</Text>
      {rows === null ? <ActivityIndicator style={styles.spinner} /> : null}
      {rows !== null && rows.length === 0 ? <Text style={hint}>{t("settings.mcp.empty")}</Text> : null}
      {(rows ?? []).map((row) => (
        <View key={row.name} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={text}>{row.name}</Text>
            <Text style={[hint, row.state === "failed" && styles.failed]}>
              {label(row)}
              {row.state === "failed" && row.error ? `: ${row.error.slice(0, 80)}` : ""}
            </Text>
          </View>
          {busy === row.name ? (
            <ActivityIndicator />
          ) : (
            <Switch
              value={isOn(row.state)}
              onValueChange={(on) => void toggle(row, on)}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          )}
        </View>
      ))}
      {error ? <Text style={[hint, styles.failed]}>{error.slice(0, 160)}</Text> : null}
      <TouchableOpacity onPress={() => void refresh()} style={styles.refresh}>
        <Text style={[styles.refreshText, isDark && styles.textDark]}>{t("settings.mcp.refresh")}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  rowText: { flex: 1, paddingRight: 12 },
  name: { fontSize: 16, fontWeight: "600", color: "#111111" },
  textDark: { color: "#ffffff" },
  hint: { fontSize: 13, color: "#666666", paddingVertical: 2 },
  hintDark: { color: "#999999" },
  failed: { color: "#ef4444" },
  spinner: { paddingVertical: 12 },
  refresh: { paddingVertical: 10, alignItems: "flex-start" },
  refreshText: { fontSize: 14, color: "#6366f1", fontWeight: "600" },
})
