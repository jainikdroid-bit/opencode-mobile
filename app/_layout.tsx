import { useEffect, useRef } from "react"
import { Stack, router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Appearance, useColorScheme, View, ActivityIndicator, AppState } from "react-native"
import { cyber } from "../src/theme/cyber"
import { Mascot } from "../src/components/Mascot"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"
import { I18nextProvider, useTranslation } from "react-i18next"
import i18n from "../src/lib/i18n/config"
import { useAuth } from "../src/stores/auth"
import { useConnections } from "../src/stores/connections"
import { useEvents } from "../src/stores/events"
import { useCatalog } from "../src/stores/catalog"
import { useSettings } from "../src/stores/settings"
import { AuthGate } from "../src/components/AuthGate"
import { ErrorBoundary } from "../src/components/ErrorBoundary"
import * as notifications from "../src/lib/notifications"
import { PermissionBanner } from "../src/components/PermissionBanner"
import { replyPermission } from "../src/lib/permission-actions"
import { useTunnelDiscovery } from "../src/lib/useTunnelDiscovery"
import { usePhoneBridge } from "../src/lib/usePhoneBridge"
import { useTailnetLifecycle } from "../src/lib/useTailnetLifecycle"
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent"

// The app is dark-only: a minimal blue-black look with neon accents.
Appearance.setColorScheme("dark")

const queryClient = new QueryClient()

function RootLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { initialize: initAuth, isLoading: authLoading } = useAuth()
  const { loadConnections, isLoading: connectionsLoading, client } = useConnections()
  const sseStarted = useRef(false)
  const notifPermissionRequested = useRef(false)

  useEffect(() => {
    initAuth()
    loadConnections()
    useSettings.getState().load()

    // Connect notification preferences to the notification module
    notifications.configure(() => useSettings.getState().notifications)

    // Navigate to session when user taps a notification. Connection-drop
    // notifications carry no sessionId (they aren't about a session) — route
    // to the home tab instead of "/session/" (an empty, dead-end route).
    const unsubNotifications = notifications.onTap((data) => {
      if (data.sessionId) router.push(`/session/${data.sessionId}`)
      else router.push("/")
    })

    // Allow / Deny pressed on a permission notification: answer without opening the app.
    const unsubActions = notifications.onAction((reply, sessionId, requestId) => {
      void replyPermission(sessionId, requestId, reply, true)
    })

    return () => {
      unsubNotifications()
      unsubActions()
    }
  }, [])

  // Re-arm the biometric app-lock when the app leaves the foreground. Without
  // this, "Require Biometric to Open" is bypassable: authenticate() sets
  // isAuthenticated=true once at cold start and nothing ever resets it, so the
  // app stays unlocked for the whole JS-process lifetime — anyone with brief
  // physical access can reopen a backgrounded app straight into session
  // history and connection details. lock() flips isAuthenticated back to false
  // so AuthGate shows the lock screen (and re-prompts) on next foreground.
  // Fire on "background" only (not the transient "inactive" that the biometric
  // prompt / app switcher / control center produce) to avoid spurious re-locks.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" && useAuth.getState().settings.requireBiometric) {
        useAuth.getState().lock()
      }
    })
    return () => sub.remove()
  }, [])

  // Android freezes JS timers and usually drops the SSE socket while the app
  // sits in the background (Doze/app standby), and the server may close idle
  // streams too. On return to foreground, re-establish the stream immediately
  // instead of waiting out the reconnect backoff (whose timers were frozen),
  // and resync messages/permissions missed while away. reconnectNow() is
  // idempotent, so an "active" fired by a transient "inactive" (biometric
  // prompt, app switcher) is harmless.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && sseStarted.current) {
        useEvents.getState().reconnectNow()
      }
    })
    return () => sub.remove()
  }, [])

  // Connect/disconnect SSE and load catalog when client changes
  useEffect(() => {
    if (client && !sseStarted.current) {
      sseStarted.current = true
      useEvents.getState().connect()
      useCatalog.getState().load()
      // Request OS notification permission once we have a live connection —
      // the in-context moment the user will start running agent tasks they'll
      // want to be pinged about. Previously this was only ever requested when
      // a user manually toggled a notification switch off→on in Settings; since
      // most categories default on, that path never fired for typical users
      // and send() silently no-op'd on every notification (permission stayed
      // "undetermined"). setup() is idempotent — it won't re-prompt once the
      // OS has a decision — so the ref just avoids redundant calls per session.
      if (!notifPermissionRequested.current) {
        notifPermissionRequested.current = true
        void notifications.setup()
      }
    } else if (!client && sseStarted.current) {
      sseStarted.current = false
      useEvents.getState().disconnect()
    }
    return () => {
      if (sseStarted.current) {
        sseStarted.current = false
        useEvents.getState().disconnect()
      }
    }
  }, [client])

  const isLoading = authLoading || connectionsLoading
  usePhoneBridge()
  useTailnetLifecycle()
  useTunnelDiscovery()
  const { hasShareIntent } = useShareIntentContext()
  useEffect(() => {
    // Another app shared something with us: let the user pick the conversation.
    if (hasShareIntent && !isLoading) router.push("/share")
  }, [hasShareIntent, isLoading])

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDark ? "#07080c" : "#ffffff",
        }}
      >
        <Mascot state="loading" size={120} />
      </View>
    )
  }

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <QueryClientProvider client={queryClient}>
            <AuthGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: cyber.bg },
                headerTintColor: cyber.cyan,
                headerTitleStyle: { color: cyber.text, fontFamily: cyber.mono, fontSize: 15 },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: cyber.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="session/[id]"
                options={{
                  title: t("session.titleFallback"),
                  presentation: "card",
                }}
              />
              <Stack.Screen
                name="connection/add"
                options={{
                  title: t("nav.addConnectionTitle"),
                  presentation: "modal",
                }}
              />
              <Stack.Screen name="share" options={{ title: t("share.title"), presentation: "modal" }} />
              <Stack.Screen name="guide" options={{ title: t("guide.title"), presentation: "modal" }} />
              <Stack.Screen name="scan" options={{ title: t("scan.title"), presentation: "modal" }} />
              <Stack.Screen name="pair-code" options={{ title: t("pairCode.title"), presentation: "modal" }} />
              <Stack.Screen name="files" options={{ title: t("files.title"), presentation: "card" }} />
              <Stack.Screen name="terminal" options={{ title: t("terminal.title"), presentation: "card" }} />
              <Stack.Screen
                name="connect"
                options={{
                  title: t("connection.pair.screenTitle"),
                  presentation: "modal",
                }}
              />
              <Stack.Screen
                name="connection/[id]"
                options={{
                  title: t("nav.editConnectionTitle"),
                  presentation: "modal",
                }}
              />
            </Stack>
              <PermissionBanner />
              <StatusBar style={isDark ? "light" : "dark"} />
            </AuthGate>
          </QueryClientProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
      </I18nextProvider>
    </ErrorBoundary>
  )
}

export default function RootLayoutWithShare() {
  return (
    <ShareIntentProvider>
      <RootLayout />
    </ShareIntentProvider>
  )
}
