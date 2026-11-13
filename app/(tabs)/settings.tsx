import { useCallback, useEffect, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  useColorScheme,
  Linking,
  Alert,
  Modal,
  Pressable,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useAuth } from "../../src/stores/auth"
import { useSettings } from "../../src/stores/settings"
import {
  categories,
  categoryMeta,
  setup as setupNotifications,
  granted as notificationsGranted,
} from "../../src/lib/notifications"
import type { Category } from "../../src/lib/notifications"
import { PRIVACY_POLICY_URL } from "../../src/lib/links"
import { CURRENT_VERSION, checkForUpdate, type AvailableUpdate } from "../../src/lib/update-check"
import { LOCALE_NAMES, SUPPORTED_LOCALES, type LocalePreference } from "../../src/lib/i18n/locale-resolve"
import { McpConnectors } from "../../src/components/McpConnectors"
import { PhoneTools } from "../../src/components/PhoneTools"
import { BuiltInTailscale } from "../../src/components/BuiltInTailscale"

function SettingRow({
  icon,
  label,
  description,
  isDark,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  description?: string
  isDark: boolean
  right?: React.ReactNode
  onPress?: () => void
}) {
  const content = (
    <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
      <View style={[styles.settingIcon, isDark && styles.settingIconDark]}>
        <Ionicons name={icon} size={22} color={isDark ? "#ffffff" : "#07080c"} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, isDark && styles.textDark]}>{label}</Text>
        {description && <Text style={[styles.settingDescription, isDark && styles.metaDark]}>{description}</Text>}
      </View>
      {right}
    </View>
  )

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>
  }

  return content
}

function SettingSection({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>{title}</Text>
      <View style={[styles.sectionContent, isDark && styles.sectionContentDark]}>{children}</View>
    </View>
  )
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { settings, hasBiometrics, updateSettings, lock } = useAuth()
  const { notifications, setNotification, locale, setLocale } = useSettings()
  const [osGranted, setOsGranted] = useState<boolean | null>(null)

  // Settings is where a user goes to ask "what am I running?". Answer it, and if
  // a newer build exists say so here too — the banner on the sessions list is
  // dismissible, this row is not (AGE-110). Uses the same 24h-throttled check,
  // so opening Settings repeatedly costs no extra requests.
  const [updateAvailable, setUpdateAvailable] = useState<AvailableUpdate | null>(null)
  useEffect(() => {
    let cancelled = false
    checkForUpdate({ ignoreDismissed: true })
      .then((result) => {
        if (!cancelled) setUpdateAvailable(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // Check OS permission state on first toggle attempt
  const handleToggle = useCallback(
    async (category: Category, enabled: boolean) => {
      if (enabled) {
        const ok = await setupNotifications()
        setOsGranted(ok)
        if (!ok) {
          Alert.alert(t("settings.alerts.notificationsDisabledTitle"), t("settings.alerts.notificationsDisabledMessage"))
          return
        }
      }
      setNotification(category, enabled)
    },
    [setNotification, t],
  )

  // Lazy-check OS permission for status display
  if (osGranted === null) {
    notificationsGranted()
      .then(setOsGranted)
      .catch(() => setOsGranted(false))
  }

  // Each language is shown in its own name, so it can be found even when the current UI language is unreadable.
  const localeLabels: Record<LocalePreference, string> = { system: t("settings.language.system"), ...LOCALE_NAMES }
  const [showLanguages, setShowLanguages] = useState(false)
  const handleLanguagePress = useCallback(() => setShowLanguages(true), [])
  const chooseLanguage = useCallback(
    (preference: LocalePreference) => {
      setShowLanguages(false)
      void setLocale(preference)
    },
    [setLocale],
  )

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]} contentContainerStyle={styles.content}>
      <SettingSection title={t("settings.sections.mcp")} isDark={isDark}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <McpConnectors isDark={isDark} />
        </View>
      </SettingSection>
      <SettingSection title={t("phone.section")} isDark={isDark}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <PhoneTools />
        </View>
      </SettingSection>
      <SettingSection title={t("tailnet.section")} isDark={isDark}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <BuiltInTailscale />
        </View>
      </SettingSection>
      <SettingSection title={t("settings.sections.security")} isDark={isDark}>
        <SettingRow
          icon="finger-print"
          label={t("settings.security.biometricOpen.label")}
          description={
            hasBiometrics
              ? t("settings.security.biometricOpen.descriptionEnabled")
              : t("settings.security.biometricOpen.descriptionUnavailable")
          }
          isDark={isDark}
          right={
            <Switch
              value={settings.requireBiometric}
              onValueChange={(value) => updateSettings({ requireBiometric: value })}
              disabled={!hasBiometrics}
              trackColor={{ false: "#767577", true: "#34f5a5" }}
            />
          }
        />
        <SettingRow
          icon="lock-closed"
          label={t("settings.security.biometricSend.label")}
          description={t("settings.security.biometricSend.description")}
          isDark={isDark}
          right={
            <Switch
              value={settings.requireBiometricForMessages}
              onValueChange={(value) => updateSettings({ requireBiometricForMessages: value })}
              disabled={!hasBiometrics || !settings.requireBiometric}
              trackColor={{ false: "#767577", true: "#34f5a5" }}
            />
          }
        />
        {settings.requireBiometric && (
          <SettingRow
            icon="exit"
            label={t("settings.security.lockNow.label")}
            description={t("settings.security.lockNow.description")}
            isDark={isDark}
            onPress={lock}
            right={<Ionicons name="chevron-forward" size={20} color={isDark ? "#8a93a8" : "#8a93a8"} />}
          />
        )}
      </SettingSection>

      <SettingSection title={t("settings.sections.notifications")} isDark={isDark}>
        {categories.map((category) => {
          const meta = categoryMeta[category]
          return (
            <SettingRow
              key={category}
              icon={meta.icon as keyof typeof Ionicons.glyphMap}
              label={t(meta.labelKey)}
              description={t(meta.descriptionKey)}
              isDark={isDark}
              right={
                <Switch
                  value={notifications[category]}
                  onValueChange={(value) => handleToggle(category, value)}
                  trackColor={{ false: "#767577", true: "#34f5a5" }}
                />
              }
            />
          )
        })}
        {osGranted === false && (
          <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
            <Text style={[styles.settingDescription, { color: "#ff4d6d", paddingLeft: 48 }]}>
              {t("settings.notifications.disabledNotice")}
            </Text>
          </View>
        )}
      </SettingSection>

      <SettingSection title={t("settings.sections.privacy")} isDark={isDark}>
        <SettingRow
          icon="document-text"
          label={t("settings.privacy.privacyPolicy.label")}
          description={t("settings.privacy.privacyPolicy.description")}
          isDark={isDark}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          right={<Ionicons name="open-outline" size={20} color={isDark ? "#8a93a8" : "#8a93a8"} />}
        />
      </SettingSection>

      <SettingSection title={t("settings.sections.about")} isDark={isDark}>
        <SettingRow
          icon="language"
          label={t("settings.language.label")}
          description={localeLabels[locale]}
          isDark={isDark}
          onPress={handleLanguagePress}
          right={<Ionicons name="chevron-forward" size={20} color={isDark ? "#8a93a8" : "#8a93a8"} />}
        />
        <SettingRow
          icon="information-circle"
          label={t("settings.about.version")}
          // Was hard-coded "1.0.0" — wrong for every build ever shipped, and the
          // one place a user could have checked what they are running while 64%
          // of the base sat on a four-week-old build (AGE-110).
          description={
            updateAvailable
              ? `${CURRENT_VERSION} → ${updateAvailable.version}`
              : `${CURRENT_VERSION} · ${t("update.upToDate")}`
          }
          isDark={isDark}
          onPress={updateAvailable ? () => Linking.openURL(updateAvailable.url) : undefined}
          right={
            updateAvailable ? (
              <Ionicons name="arrow-up-circle" size={20} color={isDark ? "#7dd3fc" : "#0369a1"} />
            ) : undefined
          }
        />
        <SettingRow
          icon="logo-github"
          label={t("settings.about.github.label")}
          description={t("settings.about.github.description")}
          isDark={isDark}
          onPress={() => Linking.openURL("https://github.com/jainikdroid-bit/opencode-mobile")}
          right={<Ionicons name="open-outline" size={20} color={isDark ? "#8a93a8" : "#8a93a8"} />}
        />
        <SettingRow
          icon="document-text"
          label={t("settings.about.docs.label")}
          description={t("settings.about.docs.description")}
          isDark={isDark}
          onPress={() => Linking.openURL("https://opencode.ai/docs")}
          right={<Ionicons name="open-outline" size={20} color={isDark ? "#8a93a8" : "#8a93a8"} />}
        />
      </SettingSection>

      <View style={styles.footer}>
        <Text style={[styles.footerText, isDark && styles.metaDark]}>{t("settings.footer.appName")}</Text>
        <Text style={[styles.footerText, isDark && styles.metaDark]}>{t("settings.footer.tagline")}</Text>
      </View>
      <Modal visible={showLanguages} transparent animationType="fade" onRequestClose={() => setShowLanguages(false)}>
        <Pressable style={styles.langBackdrop} onPress={() => setShowLanguages(false)}>
          <View style={[styles.langSheet, isDark && styles.langSheetDark]}>
            <Text style={[styles.langTitle, isDark && styles.sectionTitleDark]}>{t("settings.language.title")}</Text>
            <ScrollView>
              {(["system", ...SUPPORTED_LOCALES] as LocalePreference[]).map((preference) => (
                <TouchableOpacity key={preference} style={styles.langRow} onPress={() => chooseLanguage(preference)} testID={`language-${preference}`}>
                  <Text style={[styles.langLabel, isDark && { color: "#e8ecf4" }]}>{localeLabels[preference]}</Text>
                  {locale === preference ? <Ionicons name="checkmark" size={20} color="#22d3ee" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141926",
  },
  containerDark: {
    backgroundColor: "#07080c",
  },
  content: {
    paddingBottom: 32,
  },
  langBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  langSheet: { maxHeight: "80%", borderRadius: 12, backgroundColor: "#ffffff", paddingVertical: 8 },
  langSheetDark: { backgroundColor: "#0d1018", borderWidth: 1, borderColor: "#1d2433" },
  langTitle: { fontSize: 16, fontWeight: "700", paddingHorizontal: 20, paddingVertical: 12, color: "#07080c" },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  langLabel: { fontSize: 16, color: "#07080c" },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8a93a8",
    marginLeft: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionTitleDark: {
    color: "#8a93a8",
  },
  sectionContent: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#1c2333",
  },
  sectionContentDark: {
    backgroundColor: "#0d1018",
    borderColor: "#1c2333",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1c2333",
  },
  settingRowDark: {
    borderBottomColor: "#1c2333",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#141926",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingIconDark: {
    backgroundColor: "#1c2333",
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: "#07080c",
  },
  textDark: {
    color: "#ffffff",
  },
  settingDescription: {
    fontSize: 13,
    color: "#8a93a8",
    marginTop: 2,
  },
  metaDark: {
    color: "#8a93a8",
  },
  footer: {
    alignItems: "center",
    padding: 32,
  },
  footerText: {
    fontSize: 13,
    color: "#8a93a8",
    textAlign: "center",
  },
})
