import { useCallback, useEffect, useMemo, useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme, Linking } from "react-native"
import { Stack, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { MessageBubble, PermissionPrompt } from "../src/components/chat"
import { buildDemoScript, buildDemoCompletionMessage, buildDemoDenialMessage } from "../src/lib/demo-script"
import { SETUP_GUIDE_URL } from "../src/lib/links"

type DemoPermissionReply = "once" | "always" | "reject"

// Fully offline, scripted walkthrough for installers with no self-hosted
// opencode server. ISOLATION: every message/part below is hardcoded local
// data built once with useMemo — this screen never calls useSessions,
// useConnections, useEvents, or any sdk.ts client method, so it cannot
// create a real session, touch the network, or corrupt real app state. The
// permission "reply" only flips local component state (below); it never
// calls sessionClient.permission.reply the way app/session/[id].tsx does.
export default function DemoScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  // Built once per mount from pure, hardcoded data (src/lib/demo-script.ts).
  const script = useMemo(() => buildDemoScript(), [])
  const [reply, setReply] = useState<DemoPermissionReply | null>(null)

  const handleReply = useCallback((r: DemoPermissionReply) => {
    setReply(r)
  }, [])

  const handleConnectPress = useCallback(() => {
    router.push("/connection/add")
  }, [router])

  const completion = useMemo(() => {
    if (!reply) return null
    return reply === "reject" ? buildDemoDenialMessage() : buildDemoCompletionMessage()
  }, [reply])

  const [userMessage, assistantMessage] = script.messages

  return (
    <>
      <Stack.Screen options={{ title: t("demo.title"), presentation: "card" }} />
      <View style={[s.container, isDark && s.containerDark]} testID="demo-screen">
        <View style={[s.banner, isDark && s.bannerDark]} testID="demo-banner">
          <Ionicons name="play-circle-outline" size={16} color="#22d3ee" />
          <Text style={s.bannerText}>{t("demo.banner")}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          <MessageBubble message={userMessage} parts={script.parts[userMessage.id] || []} isDark={isDark} />
          <MessageBubble message={assistantMessage} parts={script.parts[assistantMessage.id] || []} isDark={isDark} />

          {!reply && <PermissionPrompt permission={script.permission} isDark={isDark} onReply={handleReply} />}

          {completion && (
            <MessageBubble message={completion.message} parts={completion.parts} isDark={isDark} />
          )}

          <View style={[s.ctaCard, isDark && s.ctaCardDark]} testID="demo-cta-card">
            <Text style={[s.ctaTitle, isDark && s.textWhite]}>{t("demo.ctaTitle")}</Text>
            <Text style={[s.ctaSubtitle, isDark && s.metaDark]}>{t("demo.ctaSubtitle")}</Text>
            <TouchableOpacity
              style={s.connectButton}
              onPress={handleConnectPress}
              testID="demo-connect-button"
            >
              <Text style={s.connectButtonText}>{t("demo.connectButton")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.setupGuideLink}
              onPress={() => Linking.openURL(SETUP_GUIDE_URL)}
              testID="demo-setup-guide-link"
            >
              <Text style={s.setupGuideLinkText}>{t("demo.setupGuideLink")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  containerDark: { backgroundColor: "#07080c" },
  textWhite: { color: "#ffffff" },
  metaDark: { color: "#8a93a8" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#141926",
    borderBottomWidth: 1,
    borderBottomColor: "#e9d5ff",
  },
  bannerDark: { backgroundColor: "#0a1522", borderBottomColor: "#0f2a36" },
  bannerText: { fontSize: 13, fontWeight: "600", color: "#0891b2", flex: 1 },

  scrollContent: { padding: 16, paddingBottom: 40 },

  ctaCard: {
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#141926",
    alignItems: "center",
  },
  ctaCardDark: { backgroundColor: "#0d1018" },
  ctaTitle: { fontSize: 17, fontWeight: "700", color: "#07080c", textAlign: "center" },
  ctaSubtitle: { fontSize: 13, color: "#8a93a8", marginTop: 6, textAlign: "center", lineHeight: 18 },
  connectButton: {
    marginTop: 16,
    backgroundColor: "#07080c",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  connectButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
  setupGuideLink: { marginTop: 14 },
  setupGuideLinkText: { fontSize: 14, fontWeight: "600", color: "#0891b2" },
})
