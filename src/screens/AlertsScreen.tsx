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

import { getMyAlerts, markMyAlertAsRead } from "../api/appUser";
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

function getSeverityStyle(severity: string) {
  const normalized = severity.toLowerCase();

  if (normalized === "critical" || normalized === "high") {
    return styles.highSeverity;
  }

  if (normalized === "medium" || normalized === "warning") {
    return styles.mediumSeverity;
  }

  return styles.lowSeverity;
}

export function AlertsScreen() {
  const [alerts, setAlerts] = useState<MyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
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
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.mutedText}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadAlerts(true)}
        />
      }
    >
      <Text style={styles.eyebrow}>Alerts</Text>
      <Text style={styles.title}>Network alerts</Text>
      <Text style={styles.subtitle}>
        Review high usage, device, prediction, and policy alerts.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Alert action failed</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Overview</Text>
        <Text style={styles.bigNumber}>{unreadCount}</Text>
        <Text style={styles.cardText}>unread alerts</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Latest Alerts</Text>

        {alerts.length ? (
          alerts.map((alert) => {
            const unread = isUnread(alert);
            const isUpdating = updatingAlertId === alert.id;

            return (
              <View key={alert.id} style={styles.alertRow}>
                <View style={styles.alertHeader}>
                  <View style={styles.alertTitleGroup}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.smallText}>
                      {formatDateTime(alert.created_at)}
                    </Text>
                  </View>

                  <Text
                    style={[styles.severityPill, getSeverityStyle(alert.severity)]}
                  >
                    {formatLabel(alert.severity)}
                  </Text>
                </View>

                <Text style={styles.cardText}>{alert.message}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaPill}>{formatLabel(alert.alert_type)}</Text>
                  <Text style={styles.metaPill}>{formatLabel(alert.status)}</Text>
                  {unread ? <Text style={styles.unreadPill}>Unread</Text> : null}
                </View>

                {unread ? (
                  <Pressable
                    disabled={isUpdating}
                    style={[
                      styles.readButton,
                      isUpdating && styles.readButtonDisabled,
                    ]}
                    onPress={() => void handleMarkAsRead(alert.id)}
                  >
                    <Text style={styles.readButtonText}>
                      {isUpdating ? "Updating..." : "Mark as read"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.mutedText}>
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
