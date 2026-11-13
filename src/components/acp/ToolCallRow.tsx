import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { cyber } from "../../theme/cyber"
import { DiffView } from "../chat/DiffView"
import type { ToolCall, ToolKind } from "../../lib/acp/protocol"

const ICONS: Record<ToolKind, string> = {
  read: "glasses-outline",
  edit: "code-slash-outline",
  delete: "trash-outline",
  move: "swap-horizontal-outline",
  search: "search-outline",
  execute: "terminal-outline",
  think: "bulb-outline",
  fetch: "globe-outline",
  switch_mode: "git-branch-outline",
  other: "construct-outline",
}

const MAX_TEXT = 3000

/** One tool call of the agent: what it is doing, and (tap) what it returned or changed. */
export function ToolCallRow({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false)
  const hasBody = call.content.length > 0 || call.locations.length > 0
  const status =
    call.status === "completed" ? <Ionicons name="checkmark-circle" size={16} color={cyber.green} />
    : call.status === "failed" ? <Ionicons name="close-circle" size={16} color={cyber.red} />
    : <ActivityIndicator size="small" color={cyber.cyan} />
  return (
    <View style={s.card} testID="acp-tool">
      <TouchableOpacity style={s.head} onPress={() => hasBody && setOpen(!open)} activeOpacity={hasBody ? 0.6 : 1}>
        <Ionicons name={ICONS[call.kind] as any} size={16} color={cyber.muted} />
        <Text style={s.title} numberOfLines={open ? 0 : 1}>{call.title}</Text>
        {status}
        {hasBody ? <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={cyber.muted} /> : null}
      </TouchableOpacity>
      {open ? (
        <View style={s.body}>
          {call.locations.map((l, i) => <Text key={`l${i}`} style={s.path}>{l.path}{l.line ? `:${l.line}` : ""}</Text>)}
          {call.content.map((c, i) =>
            c.kind === "diff" ? (
              <View key={i}>
                <Text style={s.path}>{c.path}</Text>
                <DiffView before={c.oldText ?? ""} after={c.newText} isDark />
              </View>
            ) : c.kind === "text" ? (
              <Text key={i} style={s.output} selectable>{c.text.length > MAX_TEXT ? `${c.text.slice(0, MAX_TEXT)}…` : c.text}</Text>
            ) : null,
          )}
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, borderColor: cyber.border, backgroundColor: cyber.surface, marginVertical: 3 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  title: { flex: 1, color: cyber.text, fontSize: 13 },
  body: { paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
  path: { color: cyber.cyan, fontSize: 12, fontFamily: cyber.mono },
  output: { color: cyber.muted, fontSize: 12, fontFamily: cyber.mono },
})
