import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getMySubscriptions,
  getMySummary,
  getMyUsageSummary,
} from "../api/appUser";
import type {
  AppUserSummary,
  DecimalLike,
  MySubscription,
  MyUsageSummary,
} from "../types/appUser";

type DashboardData = {
  summary: AppUserSummary;
  subscriptions: MySubscription[];
  usageSummary: MyUsageSummary;
};

function toNumber(value: DecimalLike | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMb(value: DecimalLike) {
  const mb = toNumber(value);

  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  return `${mb.toFixed(0)} MB`;
}

function formatMoney(value: DecimalLike) {
  return `$${toNumber(value).toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "No end date";
  }

  return new Date(value).toLocaleDateString();
}

export function HomeScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const [summary, subscriptions, usageSummary] = await Promise.all([
        getMySummary(),
        getMySubscriptions(),
        getMyUsageSummary(),
      ]);

      setData({
        summary,
        subscriptions,
        usageSummary,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load your PulseFi dashboard."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeSubscription = useMemo(() => {
    return data?.subscriptions.find((item) => item.status === "active") ?? null;
  }, [data?.subscriptions]);

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.mutedText}>Loading your PulseFi dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadDashboard(true)}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PulseFi Mobile</Text>
        <Text style={styles.title}>
          Welcome{data?.summary.full_name ? `, ${data.summary.full_name}` : ""}
        </Text>
        <Text style={styles.subtitle}>
          Monitor your subscription, usage, and internet status.
        </Text>
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not refresh dashboard</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total Usage</Text>
        <Text style={styles.bigNumber}>
          {data ? formatMb(data.usageSummary.totals.total_mb) : "0 MB"}
        </Text>

        <View style={styles.metricRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Download</Text>
            <Text style={styles.metricValue}>
              {data ? formatMb(data.usageSummary.totals.download_mb) : "0 MB"}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Upload</Text>
            <Text style={styles.metricValue}>
              {data ? formatMb(data.usageSummary.totals.upload_mb) : "0 MB"}
            </Text>
          </View>
        </View>

        <Text style={styles.smallText}>
          Records: {data?.usageSummary.totals.record_count ?? 0}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Active Subscription</Text>

        {activeSubscription ? (
          <>
            <Text style={styles.cardTitle}>
              {activeSubscription.subscription_label ??
                activeSubscription.plan.plan_name}
            </Text>
            <Text style={styles.cardText}>
              Plan: {activeSubscription.plan.plan_name}
            </Text>
            <Text style={styles.cardText}>
              Price: {formatMoney(activeSubscription.plan.monthly_price)}
            </Text>
            <Text style={styles.cardText}>
              Data limit: {toNumber(activeSubscription.plan.data_limit_gb)} GB
            </Text>
            <Text style={styles.cardText}>
              Ends: {formatDate(activeSubscription.end_date)}
            </Text>
          </>
        ) : (
          <Text style={styles.mutedText}>
            No active subscription was found for this account.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account</Text>
        <Text style={styles.cardTitle}>{data?.summary.email ?? "Unknown"}</Text>
        <Text style={styles.cardText}>
          Status: {data?.summary.status ?? "unknown"}
        </Text>
        <Text style={styles.cardText}>
          Active subscriptions: {data?.summary.active_subscriptions ?? 0}
        </Text>
        <Text style={styles.cardText}>
          Total subscriptions: {data?.summary.total_subscriptions ?? 0}
        </Text>
      </View>
    </ScrollView>
  );
}

export default HomeScreen;

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
    padding: 20,
    gap: 16,
    backgroundColor: "#F6F8FB",
  },
  header: {
    gap: 6,
    paddingTop: 16,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    color: "#00A7D8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
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
    gap: 10,
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
    fontWeight: "800",
    color: "#8A2E1B",
  },
  errorText: {
    fontSize: 14,
    color: "#8A2E1B",
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#617083",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#102033",
  },
  cardText: {
    fontSize: 15,
    color: "#33465B",
  },
  bigNumber: {
    fontSize: 38,
    fontWeight: "900",
    color: "#102033",
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricBox: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#F6F8FB",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7888",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#102033",
  },
  mutedText: {
    fontSize: 14,
    color: "#6B7888",
    textAlign: "center",
  },
  smallText: {
    fontSize: 13,
    color: "#6B7888",
  },
});

