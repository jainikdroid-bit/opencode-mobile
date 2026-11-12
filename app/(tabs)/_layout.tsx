import { Tabs } from "expo-router"
import { useColorScheme } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { cyber } from "../../src/theme/cyber"

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: cyber.cyan,
        tabBarInactiveTintColor: cyber.muted,
        tabBarLabelStyle: { fontFamily: cyber.mono, fontSize: 10, letterSpacing: 0.5 },
        tabBarStyle: { backgroundColor: cyber.bg, borderTopColor: cyber.borderGlow },
        headerStyle: { backgroundColor: cyber.bg },
        headerTintColor: cyber.cyan,
        headerTitleStyle: { color: cyber.text, fontFamily: cyber.mono, fontSize: 15 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.sessionsTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: t("nav.connectionsTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="server-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav.settingsTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
