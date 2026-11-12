import { useEffect, useMemo, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import * as ImageManipulator from "expo-image-manipulator"
import { useShareIntentContext } from "expo-share-intent"
import { cyber } from "../src/theme/cyber"
import { useSessions } from "../src/stores/sessions"
import { useShare } from "../src/stores/share"
import type { Attachment } from "../src/components/chat/ImageAttachments"
import { fenceFile, hasShareContent, planShare, type SharePlan } from "../src/lib/share-payload"

const MAX_DIMENSION = 1568

async function prepare(plan: SharePlan): Promise<{ text: string; attachments: Attachment[]; failed: string[] }> {
  const failed: string[] = [...plan.skipped]
  const attachments: Attachment[] = []
  for (const img of plan.images) {
    try {
      const w = img.width ?? 0
      const h = img.height ?? 0
      const big = Math.max(w, h) > MAX_DIMENSION
      const actions: ImageManipulator.Action[] = big ? [{ resize: w >= h ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION } }] : []
      const r = await ImageManipulator.manipulateAsync(img.uri, actions, { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8, base64: true })
      attachments.push({ uri: r.uri, mime: "image/jpeg", filename: "image.jpg", width: r.width, height: r.height, base64: r.base64 || undefined })
    } catch {
      failed.push(img.filename)
    }
  }
  const blocks: string[] = []
  for (const f of plan.textFiles) {
    try {
      blocks.push(fenceFile(f.filename, await (await fetch(f.uri)).text()))
    } catch {
      failed.push(f.filename)
    }
  }
  return { text: [plan.text, ...blocks].filter(Boolean).join("\n\n"), attachments, failed }
}

// "Share → OpenCode" lands here: choose which conversation gets the shared content.
export default function ShareScreen() {
  const { t } = useTranslation()
  const { shareIntent, resetShareIntent } = useShareIntentContext()
  const { sessions, loadSessions, createSession } = useSessions()
  const [busy, setBusy] = useState(false)
  const plan = useMemo(
    () => planShare({ text: shareIntent?.text, webUrl: shareIntent?.webUrl, files: shareIntent?.files as never }),
    [shareIntent],
  )

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const finish = (goTo?: { id: string; directory?: string }) => {
    resetShareIntent()
    if (goTo) router.replace({ pathname: "/session/[id]", params: { id: goTo.id, ...(goTo.directory ? { directory: goTo.directory } : {}) } })
    else router.replace("/")
  }

  const choose = async (target: { id: string; directory?: string } | "new") => {
    if (busy) return
    setBusy(true)
    try {
      const prepared = await prepare(plan)
      if (prepared.failed.length) Alert.alert(t("share.skippedTitle"), prepared.failed.join("\n"))
      let dest = target
      if (target === "new") {
        const created = await createSession()
        if (!created) throw new Error("create failed")
        dest = { id: created.id, directory: created.directory }
      }
      useShare.getState().setPending({ text: prepared.text, attachments: prepared.attachments })
      finish(dest as { id: string; directory?: string })
    } catch {
      setBusy(false)
      Alert.alert(t("share.failedTitle"), t("share.failedMessage"))
    }
  }

  const summary = [
    plan.text ? plan.text.slice(0, 120) : null,
    plan.images.length ? t("share.images", { count: plan.images.length }) : null,
    plan.textFiles.length ? t("share.files", { count: plan.textFiles.length }) : null,
  ].filter(Boolean)
  const usable = hasShareContent(plan)

  return (
    <View style={s.root}>
      <View style={s.card}>
        <Ionicons name="share-outline" size={20} color={cyber.cyan} />
        <Text style={s.summary} numberOfLines={4}>
          {usable ? summary.join(" · ") : t("share.nothing")}
        </Text>
      </View>
      <TouchableOpacity style={s.newBtn} onPress={() => void choose("new")} disabled={busy || !usable} testID="share-new">
        <Ionicons name="add-circle-outline" size={18} color={cyber.bg} />
        <Text style={s.newText}>{t("share.newSession")}</Text>
      </TouchableOpacity>
      <Text style={s.label}>{t("share.orPick")}</Text>
      {busy ? <ActivityIndicator color={cyber.cyan} style={{ margin: 12 }} /> : null}
      <FlatList
        data={sessions.slice(0, 30)}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => void choose({ id: item.id, directory: item.directory })} disabled={busy || !usable}>
            <Text style={s.rowText} numberOfLines={1}>{item.title || t("sessionsList.untitledSession")}</Text>
            <Ionicons name="chevron-forward" size={18} color={cyber.muted} />
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity onPress={() => finish()} style={s.cancel}>
        <Text style={s.cancelText}>{t("common.cancel")}</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: cyber.bg, padding: 12 },
  card: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: cyber.borderGlow, backgroundColor: cyber.surface },
  summary: { flex: 1, color: cyber.text, fontSize: 13 },
  newBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 44, borderRadius: 8, backgroundColor: cyber.cyan, marginTop: 12 },
  newText: { color: cyber.bg, fontWeight: "700" },
  label: { color: cyber.muted, fontSize: 12, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cyber.borderGlow },
  rowText: { flex: 1, color: cyber.text, fontSize: 14 },
  cancel: { alignItems: "center", padding: 14 },
  cancelText: { color: cyber.muted },
})
