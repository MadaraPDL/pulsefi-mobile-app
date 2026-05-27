import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";

import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import { useSelectedRouter } from "../state/SelectedRouterContext";

import {
  getMyRouters,
  getMySubscriptions,
  getMySummary,
  getMyUsageSummary,
} from "../api/appUser";
import type {
  AppUserSummary,
  DecimalLike,
  MyRouter,
  MySubscription,
  MyUsageSummary,
} from "../types/appUser";

type DashboardData = {
  summary: AppUserSummary;
  usageSummary: MyUsageSummary | null;
  subscriptions: MySubscription[];
  routers: MyRouter[];
};

function toNumber(value: DecimalLike | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMb(value: DecimalLike | number) {
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

function getRouterDisplayName(router: MyRouter | null) {
  return router?.router_name ?? router?.router_model ?? "No router selected";
}

function normalizeUsageSummary(summary: MyUsageSummary | null | undefined) {
  const totals = summary?.totals;

  if (!totals) {
    return {
      total_mb: 0,
      download_mb: 0,
      upload_mb: 0,
      record_count: 0,
    };
  }

  return {
    total_mb: toNumber(totals.total_mb),
    download_mb: toNumber(totals.download_mb),
    upload_mb: toNumber(totals.upload_mb),
    record_count: totals.record_count,
  };
}


export function HomeScreen() {
  const { colors } = usePulseFiTheme();
  const { selectedRouterId, setSelectedRouterId } = useSelectedRouter();
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

      const [summary, subscriptions, routers] = await Promise.all([
        getMySummary(),
        getMySubscriptions(),
        getMyRouters(),
      ]);

      const effectiveRouterId =
        selectedRouterId ??
        routers.find((router) => router.user_subscription_id)?.id ??
        routers[0]?.id ??
        null;

      const usageSummary = effectiveRouterId
        ? await getMyUsageSummary(effectiveRouterId)
        : null;

      setData({
        summary,
        usageSummary,
        subscriptions,
        routers,
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
  }, [selectedRouterId]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();

      const refreshTimer = setInterval(() => {
        void loadDashboard();
      }, 30000);

      return () => clearInterval(refreshTimer);
    }, [loadDashboard])
  );

  const selectedRouter = useMemo(() => {
    if (!data?.routers.length) {
      return null;
    }

    return (
      data.routers.find((router) => router.id === selectedRouterId) ??
      data.routers[0]
    );
  }, [data?.routers, selectedRouterId]);

  useEffect(() => {
    if (!data?.routers.length) {
      return;
    }

    const matchingRouter = selectedRouterId
      ? data.routers.find((router) => router.id === selectedRouterId)
      : null;

    const fallbackRouter =
      data.routers.find((router) => router.user_subscription_id) ??
      data.routers[0];

    const nextRouterId = matchingRouter?.id ?? fallbackRouter?.id ?? null;

    if (nextRouterId && selectedRouterId !== nextRouterId) {
      setSelectedRouterId(nextRouterId);
    }
  }, [data?.routers, selectedRouterId, setSelectedRouterId]);

  const selectedSubscription = useMemo(() => {
    if (!selectedRouter?.user_subscription_id) {
      return null;
    }

    return (
      data?.subscriptions.find(
        (item) => item.id === selectedRouter.user_subscription_id
      ) ?? null
    );
  }, [data?.subscriptions, selectedRouter]);

  const selectedRouterTotals = useMemo(
    () => normalizeUsageSummary(data?.usageSummary),
    [data?.usageSummary]
  );

  if (isLoading && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
          Loading your PulseFi dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          tintColor={colors.primary}
          onRefresh={() => void loadDashboard(true)}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>
          PulseFi Mobile
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Welcome{data?.summary.full_name ? `, ${data.summary.full_name}` : ""}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Monitor the selected router, service line, and usage.
        </Text>
      </View>

      {errorMessage ? (
        <View
          style={[
            styles.errorCard,
            {
              backgroundColor: colors.dangerBackground,
              borderColor: colors.dangerBorder,
            },
          ]}
        >
          <Text style={[styles.errorTitle, { color: colors.dangerText }]}>
            Could not refresh dashboard
          </Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Selected Router
        </Text>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {getRouterDisplayName(selectedRouter)}
        </Text>

        {data?.routers.length ? (
          <View style={styles.routerPicker}>
            {data.routers.map((router) => {
              const active = selectedRouter?.id === router.id;

              return (
                <Pressable
                  key={router.id}
                  style={[
                    styles.routerChip,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active
                        ? (colors.mode === "dark" ? "rgba(0, 209, 255, 0.12)" : "#EAF9FE")
                        : colors.surfaceMuted,
                    },
                  ]}
                  onPress={() => setSelectedRouterId(router.id)}
                >
                  <Text
                    style={[
                      styles.routerChipText,
                      {
                        color: active ? colors.primary : colors.textMuted,
                      },
                    ]}
                  >
                    {getRouterDisplayName(router)}
                  </Text>
                  <Text style={[styles.routerChipSubtext, { color: colors.textSubtle }]}>
                    {router.id.slice(0, 8)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {selectedSubscription ? (
          <>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Service line:{" "}
              <Text style={[styles.boldText, { color: colors.text }]}>
                {selectedSubscription.subscription_label ??
                  getRouterDisplayName(selectedRouter)}
              </Text>
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Package:{" "}
              <Text style={[styles.boldText, { color: colors.text }]}>
                {selectedSubscription.plan.plan_name}
              </Text>
            </Text>
          </>
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            Open More → Routers to select a router.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Selected Router Usage
        </Text>
        <Text style={[styles.bigNumber, { color: colors.text }]}>
          {formatMb(selectedRouterTotals.total_mb)}
        </Text>

        <View style={styles.metricRow}>
          <View
            style={[
              styles.metricBox,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
              Download
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatMb(selectedRouterTotals.download_mb)}
            </Text>
          </View>

          <View
            style={[
              styles.metricBox,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
              Upload
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatMb(selectedRouterTotals.upload_mb)}
            </Text>
          </View>
        </View>

        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          Summary records for this router: {selectedRouterTotals.record_count}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Selected Service Line
        </Text>

        {selectedSubscription ? (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {selectedSubscription.subscription_label ??
                selectedSubscription.plan.plan_name}
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Plan: {selectedSubscription.plan.plan_name}
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Price: {formatMoney(selectedSubscription.plan.monthly_price)}
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Data limit: {toNumber(selectedSubscription.plan.data_limit_gb)} GB
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Ends: {formatDate(selectedSubscription.end_date)}
            </Text>
          </>
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No selected service line was found.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Account
        </Text>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {data?.summary.email ?? "Unknown"}
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Status: {data?.summary.status ?? "unknown"}
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Active subscriptions: {data?.summary.active_subscriptions ?? 0}
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
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
  boldText: {
    fontWeight: "900",
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
    borderWidth: 1,
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
  routerPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  routerChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  routerChipText: {
    fontSize: 12,
    fontWeight: "900",
  },
  routerChipSubtext: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
});
