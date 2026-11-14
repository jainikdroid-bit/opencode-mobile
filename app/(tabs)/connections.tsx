import { View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme, Alert } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { Mascot } from "../../src/components/Mascot"
import { useConnections } from "../../src/stores/connections"
import { useSettings } from "../../src/stores/settings"
import type { ServerConnection } from "../../src/lib/types"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const

function ConnectionItem({
  connection,
  isDark,
  isActive,
  onSelect,
  onEdit,
  onDelete,
}: {
  connection: ServerConnection
  isDark: boolean
  isActive: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const typeIcon = connection.type === "local" ? "wifi" : connection.type === "tunnel" ? "globe" : "cloud"

  const handleLongPress = () => {
    Alert.alert(connection.name, t("connectionsList.actionsAlert.message"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("connectionsList.actionsAlert.edit"), onPress: onEdit },
      { text: t("common.delete"), style: "destructive", onPress: onDelete },
    ])
  }

  return (
    <TouchableOpacity
      style={[
        styles.connectionItem,
        isDark && styles.connectionItemDark,
        isActive && styles.connectionItemActive,
        isActive && isDark && styles.connectionItemActiveDark,
      ]}
      onPress={onSelect}
      onLongPress={handleLongPress}
    >
      <View style={styles.connectionIcon}>
        <Ionicons name={typeIcon} size={24} color={isActive ? "#34f5a5" : isDark ? "#8a93a8" : "#8a93a8"} />
      </View>
      <View style={styles.connectionContent}>
        <View style={styles.connectionHeader}>
          <Text
            style={[
              styles.connectionName,
              isDark && styles.textDark,
              isActive && styles.connectionNameActive,
              isActive && isDark && styles.connectionNameActiveDark,
            ]}
          >
            {connection.name}
          </Text>
          {isActive && (
            <View style={[styles.activeBadge, isDark && styles.activeBadgeDark]}>
              <Text style={[styles.activeBadgeText, isDark && styles.activeBadgeTextDark]}>
                {t("connectionsList.activeBadge")}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.connectionUrl, isDark && styles.metaDark, isActive && styles.connectionUrlActive]}
          numberOfLines={1}
        >
          {connection.url}
        </Text>
        {connection.lastConnected && (
          <Text style={[styles.connectionMeta, isDark && styles.metaDark]}>
            {t("connectionsList.lastConnected", { date: new Date(connection.lastConnected).toLocaleDateString() })}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={isDark ? "#8a93a8" : "#8a93a8"} />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default function ConnectionsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { connections, activeConnection, setActiveConnection, removeConnection } = useConnections()
  const { pageSize, setPageSize } = useSettings()

  const handleDelete = (connection: ServerConnection) => {
    Alert.alert(
      t("connection.edit.alerts.deleteTitle"),
      t("connection.edit.alerts.deleteMessage", { name: connection.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => removeConnection(connection.id),
        },
      ],
    )
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConnectionItem
            connection={item}
            isDark={isDark}
            isActive={activeConnection?.id === item.id}
            onSelect={() => setActiveConnection(item.id)}
            onEdit={() => router.push(`/connection/${item.id}`)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Mascot state="offline" size={110} interactive />
            <Text style={[styles.emptyTitle, isDark && styles.textDark]}>{t("connectionsList.empty.title")}</Text>
            <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
              {t("connectionsList.empty.subtitle")}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={[styles.header, isDark && styles.headerDark]}>
            <Text style={[styles.headerText, isDark && styles.metaDark]}>{t("connectionsList.header")}</Text>
          </View>
        }
        ListFooterComponent={
          <View style={[styles.settingsSection, isDark && styles.settingsSectionDark]}>
            <Text style={[styles.settingsTitle, isDark && styles.textDark]}>
              {t("connectionsList.preferences.title")}
            </Text>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="layers-outline" size={18} color={isDark ? "#8a93a8" : "#8a93a8"} />
                <Text style={[styles.settingText, isDark && styles.textDark]}>
                  {t("connectionsList.preferences.pageSizeLabel")}
                </Text>
              </View>
              <View style={styles.pagePicker}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.pageOption,
                      isDark && styles.pageOptionDark,
                      pageSize === size && styles.pageOptionActive,
                      pageSize === size && isDark && styles.pageOptionActiveDark,
                    ]}
                    onPress={() => setPageSize(size)}
                  >
                    <Text
                      style={[
                        styles.pageOptionText,
                        isDark && styles.metaDark,
                        pageSize === size && styles.pageOptionTextActive,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={[styles.settingHint, isDark && styles.metaDark]}>
              {t("connectionsList.preferences.pageSizeHint")}
            </Text>
          </View>
        }
        contentContainerStyle={connections.length === 0 ? styles.emptyContent : undefined}
      />

      {/* FAB to add connection */}
      <TouchableOpacity style={[styles.fab, isDark && styles.fabDark]} onPress={() => router.push("/connection/add")}>
        <Ionicons name="add" size={28} color={isDark ? "#07080c" : "#ffffff"} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#07080c",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1c2333",
  },
  headerDark: {
    borderBottomColor: "#0d1018",
  },
  headerText: {
    fontSize: 13,
    color: "#8a93a8",
  },
  connectionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1c2333",
  },
  connectionItemDark: {
    borderBottomColor: "#0d1018",
  },
  connectionItemActive: {
    backgroundColor: "#f0fdf4",
  },
  connectionItemActiveDark: {
    backgroundColor: "#1a2e1a",
  },
  connectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#141926",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  connectionContent: {
    flex: 1,
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#07080c",
  },
  connectionNameActive: {
    color: "#07080c",
  },
  connectionNameActiveDark: {
    color: "#ffffff",
  },
  textDark: {
    color: "#ffffff",
  },
  activeBadge: {
    backgroundColor: "#34f5a5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeDark: {
    backgroundColor: "#16a34a",
  },
  activeBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  activeBadgeTextDark: {
    color: "#ffffff",
  },
  connectionUrl: {
    fontSize: 13,
    color: "#8a93a8",
    marginTop: 2,
  },
  connectionUrlActive: {
    color: "#8a93a8",
  },
  connectionMeta: {
    fontSize: 12,
    color: "#8a93a8",
    marginTop: 4,
  },
  metaDark: {
    color: "#8a93a8",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    color: "#07080c",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8a93a8",
    marginTop: 8,
    textAlign: "center",
  },
  emptyContent: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#07080c",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabDark: {
    backgroundColor: "#22d3ee",
  },
  settingsSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1c2333",
    marginTop: 16,
    gap: 10,
  },
  settingsSectionDark: {
    borderTopColor: "#0d1018",
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#07080c",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingText: {
    fontSize: 14,
    color: "#07080c",
  },
  pagePicker: {
    flexDirection: "row",
    gap: 6,
  },
  pageOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1c2333",
    backgroundColor: "#141926",
  },
  pageOptionDark: {
    borderColor: "#1c2333",
    backgroundColor: "#0d1018",
  },
  pageOptionActive: {
    backgroundColor: "#07080c",
    borderColor: "#07080c",
  },
  pageOptionActiveDark: {
    backgroundColor: "#22d3ee",
    borderColor: "#22d3ee",
  },
  pageOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8a93a8",
  },
  pageOptionTextActive: {
    color: "#ffffff",
  },
  settingHint: {
    fontSize: 12,
    color: "#8a93a8",
  },
})
