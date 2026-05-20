import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { usePulseFiTheme } from "../theme/usePulseFiTheme";

import { getMyAlert, getMyAlerts, markMyAlertAsRead } from "../api/appUser";
import type { MyAlert } from "../types/appUser";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function isUnread(alert: MyAlert) {
  return alert.read_at === null && alert.status !== "read";
}

function getSeverityStyle(
  severity: string,
  colors: ReturnType<typeof usePulseFiTheme>["colors"]
) {
  const normalized = severity.toLowerCase();

  if (normalized === "critical" || normalized === "high") {
    return {
      color: colors.dangerText,
      backgroundColor: colors.dangerBackground,
      borderColor: colors.dangerBorder,
    };
  }

  if (normalized === "medium" || normalized === "warning") {
    return {
      color: "#FFD66B",
      backgroundColor: "#302511",
      borderColor: "#6F5012",
    };
  }

  return {
    color: colors.successText,
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
  };
}

export function AlertsScreen() {
  const { colors } = usePulseFiTheme();
  const [alerts, setAlerts] = useState<MyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [loadingAlertDetailId, setLoadingAlertDetailId] =
    useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<MyAlert | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAlerts = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const result = await getMyAlerts(50);
      setAlerts(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load your alerts."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const unreadCount = useMemo(() => {
    return alerts.filter(isUnread).length;
  }, [alerts]);

  async function handleViewAlertDetail(alertId: string) {
    if (selectedAlert?.id === alertId) {
      setSelectedAlert(null);
      return;
    }

    try {
      setLoadingAlertDetailId(alertId);
      setErrorMessage(null);

      const detail = await getMyAlert(alertId);
      setSelectedAlert(detail);

      setAlerts((currentAlerts) =>
        currentAlerts.map((alert) => (alert.id === detail.id ? detail : alert))
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load alert details."
      );
    } finally {
      setLoadingAlertDetailId(null);
    }
  }

  async function handleMarkAsRead(alertId: string) {
    try {
      setUpdatingAlertId(alertId);
      setErrorMessage(null);

      const updatedAlert = await markMyAlertAsRead(alertId);

      setAlerts((currentAlerts) =>
        currentAlerts.map((alert) =>
          alert.id === updatedAlert.id ? updatedAlert : alert
        )
      );

      setSelectedAlert((currentSelected) =>
        currentSelected?.id === updatedAlert.id ? updatedAlert : currentSelected
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not mark alert as read."
      );
    } finally {
      setUpdatingAlertId(null);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          tintColor={colors.primary}
          onRefresh={() => void loadAlerts(true)}
        />
      }
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>Alerts</Text>
      <Text style={[styles.title, { color: colors.text }]}>Network alerts</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Review high usage, device, prediction, and policy alerts.
      </Text>

      {errorMessage ? (
        <View style={[styles.errorCard, { backgroundColor: colors.dangerBackground, borderColor: colors.dangerBorder }]}>
          <Text style={[styles.errorTitle, { color: colors.dangerText }]}>Alert action failed</Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Overview</Text>
        <Text style={[styles.bigNumber, { color: colors.text }]}>{unreadCount}</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>unread alerts</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Latest Alerts</Text>

        {alerts.length ? (
          alerts.map((alert) => {
            const unread = isUnread(alert);
            const isUpdating = updatingAlertId === alert.id;
            const isLoadingDetail = loadingAlertDetailId === alert.id;
            const selected = selectedAlert?.id === alert.id;
            const detailAlert = selectedAlert?.id === alert.id ? selectedAlert : alert;

            return (
              <View key={alert.id} style={[styles.alertRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderTopColor: colors.border, borderTopWidth: 0, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 10 }]}>
                <View style={styles.alertHeader}>
                  <View style={styles.alertTitleGroup}>
                    <Text style={[styles.alertTitle, { color: colors.text }]}>{alert.title}</Text>
                    <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                      {formatDateTime(alert.created_at)}
                    </Text>
                  </View>

                  <Text
                    style={[styles.severityPill, getSeverityStyle(alert.severity, colors)]}
                  >
                    {formatLabel(alert.severity)}
                  </Text>
                </View>

                <Text style={[styles.cardText, { color: colors.textMuted }]}>{alert.message}</Text>

                <View style={styles.metaRow}>
                  <Text style={[styles.metaPill, { backgroundColor: colors.surfaceMuted, color: colors.textMuted, borderColor: colors.border }]}>{formatLabel(alert.alert_type)}</Text>
                  <Text style={[styles.metaPill, { backgroundColor: colors.surfaceMuted, color: colors.textMuted, borderColor: colors.border }]}>{formatLabel(alert.status)}</Text>
                  {unread ? <Text style={[styles.unreadPill, { backgroundColor: colors.surfaceMuted, color: colors.primary, borderColor: colors.border }]}>Unread</Text> : null}
                </View>

                {selected ? (
                  <View
                    style={{
                      borderRadius: 16,
                      padding: 12,
                      gap: 8,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.primary,
                    }}
                  >
                    <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
                      Alert details
                    </Text>

                    <Text style={[styles.cardText, { color: colors.textMuted }]}>
                      Type:{" "}
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {formatLabel(detailAlert.alert_type)}
                      </Text>
                    </Text>

                    <Text style={[styles.cardText, { color: colors.textMuted }]}>
                      Status:{" "}
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {formatLabel(detailAlert.status)}
                      </Text>
                    </Text>

                    <Text style={[styles.cardText, { color: colors.textMuted }]}>
                      Severity:{" "}
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {formatLabel(detailAlert.severity)}
                      </Text>
                    </Text>

                    <Text style={[styles.cardText, { color: colors.textMuted }]}>
                      Created:{" "}
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {formatDateTime(detailAlert.created_at)}
                      </Text>
                    </Text>

                    <Text style={[styles.cardText, { color: colors.textMuted }]}>
                      Read:{" "}
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {detailAlert.read_at
                          ? formatDateTime(detailAlert.read_at)
                          : "Not read yet"}
                      </Text>
                    </Text>

                    <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                      Related IDs: device {detailAlert.device_id ?? "none"} ? usage{" "}
                      {detailAlert.usage_id ?? "none"} ? prediction{" "}
                      {detailAlert.prediction_id ?? "none"}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <Pressable
                    disabled={isLoadingDetail}
                    style={[
                      styles.readButton,
                      {
                        backgroundColor: selected
                          ? colors.primary
                          : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                      isLoadingDetail && styles.readButtonDisabled,
                    ]}
                    onPress={() => void handleViewAlertDetail(alert.id)}
                  >
                    <Text
                      style={[
                        styles.readButtonText,
                        {
                          color: selected
                            ? colors.buttonText
                            : colors.text,
                        },
                      ]}
                    >
                      {isLoadingDetail
                        ? "Loading..."
                        : selected
                          ? "Hide details"
                          : "View details"}
                    </Text>
                  </Pressable>

                  {unread ? (
                    <Pressable
                      disabled={isUpdating}
                      style={[
                        styles.readButton,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                        isUpdating && styles.readButtonDisabled,
                      ]}
                      onPress={() => void handleMarkAsRead(alert.id)}
                    >
                      <Text style={[styles.readButtonText, { color: colors.text }]}>
                        {isUpdating ? "Updating..." : "Mark as read"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No alerts found yet. Alerts will appear after simulator ingestion or
            intelligence runs create usage/device events.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

export default AlertsScreen;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#F6F8FB",
  },
  container: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
    backgroundColor: "#F6F8FB",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    color: "#00A7D8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#102033",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5D6B7A",
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
  },
  errorCard: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
    backgroundColor: "#FFF3F0",
    borderWidth: 1,
    borderColor: "#FFD1C7",
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8A2E1B",
  },
  errorText: {
    fontSize: 14,
    color: "#8A2E1B",
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#617083",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  bigNumber: {
    fontSize: 38,
    fontWeight: "900",
    color: "#102033",
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#33465B",
  },
  alertRow: {
    borderTopWidth: 1,
    borderTopColor: "#E3EAF2",
    paddingTop: 14,
    gap: 10,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  alertTitleGroup: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#102033",
  },
  severityPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    textTransform: "capitalize",
  },
  highSeverity: {
    color: "#8A2E1B",
    backgroundColor: "#FFF3F0",
  },
  mediumSeverity: {
    color: "#8A5B00",
    backgroundColor: "#FFF5D7",
  },
  lowSeverity: {
    color: "#0B5D7A",
    backgroundColor: "#EAF9FE",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "800",
    color: "#617083",
    backgroundColor: "#F6F8FB",
    overflow: "hidden",
    textTransform: "capitalize",
  },
  unreadPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    color: "#00A7D8",
    backgroundColor: "#EAF9FE",
    overflow: "hidden",
  },
  readButton: {
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: "#102033",
  },
  readButtonDisabled: {
    opacity: 0.7,
  },
  readButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  mutedText: {
    fontSize: 14,
    color: "#6B7888",
    textAlign: "center",
  },
  smallText: {
    fontSize: 12,
    color: "#6B7888",
  },
});
