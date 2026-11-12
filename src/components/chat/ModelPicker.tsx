import { useState, useCallback, useMemo, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import BottomSheet, { BottomSheetBackdrop, BottomSheetSectionList, BottomSheetTextInput } from "@gorhom/bottom-sheet"
import { useTranslation } from "react-i18next"
import { matchesSource, countBySource, type SourceFilter } from "../../lib/model-source"

interface ModelItem {
  providerID: string
  providerName: string
  modelID: string
  modelName: string
}

interface Provider {
  id: string
  name: string
  local?: boolean
  models: Array<{ id: string; name: string }>
}

interface Props {
  providers: Provider[]
  selected: { providerID: string; modelID: string } | null
  isDark: boolean
  onSelect: (providerID: string, modelID: string) => void
  sheetRef: React.RefObject<BottomSheet | null>
}

export function ModelPicker({ providers, selected, isDark, onSelect, sheetRef }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [source, setSource] = useState<SourceFilter>("all")
  const counts = useMemo(() => countBySource(Array.isArray(providers) ? providers : []), [providers])

  const sections = useMemo(() => {
    const list = Array.isArray(providers) ? providers : []
    const q = search.toLowerCase()
    const result = list
      .filter((p) => matchesSource(p, source))
      .map((p) => {
        const models = (p.models || [])
          .filter(
            (m) =>
              !q ||
              m.id.toLowerCase().includes(q) ||
              m.name.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q),
          )
          .map((m) => ({
            providerID: p.id,
            providerName: p.name || p.id,
            modelID: m.id,
            modelName: m.name || m.id,
          }))
        // Sort selected model to top within its group
        if (selected) {
          models.sort((a, b) => {
            const aActive = a.providerID === selected.providerID && a.modelID === selected.modelID
            const bActive = b.providerID === selected.providerID && b.modelID === selected.modelID
            return aActive === bActive ? 0 : aActive ? -1 : 1
          })
        }
        return { title: p.name || p.id, local: p.local === true, data: models }
      })
      .filter((s) => s.data.length > 0)
    // Sort the section containing the selected model to the top
    if (selected) {
      result.sort((a, b) => {
        const aHas = a.data.some((m) => m.providerID === selected.providerID && m.modelID === selected.modelID)
        const bHas = b.data.some((m) => m.providerID === selected.providerID && m.modelID === selected.modelID)
        return aHas === bHas ? 0 : aHas ? -1 : 1
      })
    }
    return result
  }, [providers, search, selected, source])

  const handleSelect = useCallback(
    (providerID: string, modelID: string) => {
      onSelect(providerID, modelID)
      setSearch("")
      sheetRef.current?.close()
    },
    [onSelect, sheetRef],
  )

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["50%", "80%"]}
      // See DirectoryBrowserSheet.tsx for why this is required alongside
      // static snapPoints (issue #104): without it the sheet can never open.
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={isDark ? s.sheetDark : s.sheet}
      handleIndicatorStyle={{ backgroundColor: isDark ? "#8a93a8" : "#cccccc" }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      )}
      onChange={(idx) => {
        if (idx === -1) setSearch("")
      }}
    >
      <View style={s.header}>
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.modelPicker.title")}</Text>
        <View style={s.sourceRow} testID="model-source-filter">
          {(["all", "local", "cloud"] as const).map((key) => (
            <TouchableOpacity
              key={key}
              style={[s.sourceChip, isDark && s.sourceChipDark, source === key && s.sourceChipActive]}
              onPress={() => setSource(key)}
              testID={`model-source-${key}`}
            >
              <Text style={[s.sourceText, isDark && s.textWhite, source === key && s.sourceTextActive]}>
                {t(`chat.modelPicker.source.${key}`)} · {counts[key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <BottomSheetTextInput
          style={[s.search, isDark && s.searchDark]}
          placeholder={t("chat.modelPicker.searchPlaceholder")}
          placeholderTextColor={isDark ? "#8a93a8" : "#8a93a8"}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      <BottomSheetSectionList
        sections={sections}
        keyExtractor={(item: ModelItem) => `${item.providerID}/${item.modelID}`}
        renderSectionHeader={({ section }: { section: { title: string; local?: boolean } }) => (
          <View style={[s.sectionHeader, isDark && s.sectionHeaderDark]}>
            <Text style={[s.sectionTitle, isDark && s.metaDark]}>{section.title}</Text>
            {section.local ? (
              <View style={s.localBadge}>
                <Ionicons name="hardware-chip-outline" size={12} color="#16a34a" />
                <Text style={s.localBadgeText}>{t("chat.modelPicker.localBadge")}</Text>
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item }: { item: ModelItem }) => {
          const active = selected?.providerID === item.providerID && selected?.modelID === item.modelID
          return (
            <TouchableOpacity
              style={[s.row, isDark && s.rowDark, active && (isDark ? s.rowSelectedDark : s.rowSelected)]}
              onPress={() => handleSelect(item.providerID, item.modelID)}
              testID={`model-option-${item.providerID}-${item.modelID}`}
            >
              <View style={s.rowText}>
                <Text style={[s.rowName, isDark && s.textWhite]} numberOfLines={1}>
                  {item.modelName || item.modelID}
                </Text>
                <Text style={[s.rowProvider, isDark && s.metaDark]}>{item.providerName || item.providerID}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={20} color="#22d3ee" />}
            </TouchableOpacity>
          )
        }}
        contentContainerStyle={s.content}
        stickySectionHeadersEnabled
      />
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  sheet: { backgroundColor: "#ffffff" },
  sheetDark: { backgroundColor: "#0d1018" },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  title: { fontSize: 18, fontWeight: "700", color: "#07080c" },
  textWhite: { color: "#ffffff" },
  search: {
    backgroundColor: "#141926",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#07080c",
  },
  searchDark: { backgroundColor: "#1c2333", color: "#ffffff" },
  content: { paddingBottom: 40 },
  sectionHeader: {
    backgroundColor: "#141926",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  localBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  localBadgeText: { fontSize: 11, fontWeight: "600", color: "#16a34a" },
  sourceRow: { flexDirection: "row", gap: 8 },
  sourceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1c2333",
  },
  sourceChipDark: { borderColor: "#404040" },
  sourceChipActive: { backgroundColor: "#22d3ee", borderColor: "#22d3ee" },
  sourceText: { fontSize: 13, color: "#525252" },
  sourceTextActive: { color: "#ffffff", fontWeight: "600" },
  sectionHeaderDark: { backgroundColor: "#0a0d14" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a93a8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaDark: { color: "#8a93a8" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1c2333",
  },
  rowDark: { borderBottomColor: "#1c2333" },
  rowSelected: { backgroundColor: "#141926" },
  rowSelectedDark: { backgroundColor: "#0c1a26" },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "500", color: "#07080c" },
  rowProvider: { fontSize: 12, color: "#8a93a8", marginTop: 1 },
})
