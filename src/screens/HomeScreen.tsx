import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getMySummary } from "../api/appUser";
import { clearSession } from "../auth/session";
import { colors } from "../theme/colors";
import type { AppUserSummary } from "../types/appUser";

export function HomeScreen({ onLogout }: { onLogout: () => void }) {
  const [summary, setSummary] = useState<AppUserSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadSummary() {
    setErrorMessage("");

    try {
      const data = await getMySummary();
      setSummary(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load summary."
      );
    }
  }

  async function refresh() {
    setIsRefreshing(true);
    await loadSummary();
    setIsRefreshing(false);
  }

  async function handleLogout() {
    await clearSession();
    onLogout();
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>PulseFi Mobile</Text>
          <Text style={styles.title}>
            {summary ? `Welcome, ${summary.full_name}` : "Welcome"}
          </Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {!summary && !errorMessage ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Loading your account...</Text>
        </View>
      ) : null}

      {summary ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Account</Text>
            <Text style={styles.cardTitle}>{summary.email}</Text>
            <Text style={styles.muted}>
              Username: {summary.username ?? "Not set"}
            </Text>
            <Text style={styles.muted}>Status: {summary.status}</Text>
          </View>

          <View style={styles.grid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.total_subscriptions}</Text>
              <Text style={styles.statLabel}>Total subscriptions</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.active_subscriptions}</Text>
              <Text style={styles.statLabel}>Active subscriptions</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Next checkpoint</Text>
            <Text style={styles.cardTitle}>Usage, devices, alerts</Text>
            <Text style={styles.muted}>
              After this login checkpoint works, we add bottom tabs connected to
              your real App User backend APIs.
            </Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingTop: 54,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 4,
  },
  logoutButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "800",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 18,
    gap: 7,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
  },
  statValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  loadingBox: {
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 24,
  },
  error: {
    borderRadius: 14,
    backgroundColor: "#fff1f1",
    color: colors.danger,
    padding: 12,
    fontWeight: "700",
  },
});
