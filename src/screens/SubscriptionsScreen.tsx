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

import { getMySubscription, getMySubscriptions } from "../api/appUser";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type { DecimalLike, MySubscription } from "../types/appUser";

function toNumber(value: DecimalLike | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: DecimalLike) {
  return `$${toNumber(value).toFixed(2)}`;
}

function formatGb(value: DecimalLike) {
  return `${toNumber(value).toFixed(0)} GB`;
}

function formatMbps(value: DecimalLike | null) {
  if (value === null) {
    return "Not limited";
  }

  return `${toNumber(value).toFixed(0)} Mbps`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "No end date";
  }

  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function isActiveSubscription(subscription: MySubscription) {
  return subscription.status.toLowerCase() === "active";
}

export function SubscriptionsScreen() {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] =
    useState<MySubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const result = await getMySubscriptions();
      setSubscriptions(result);

      setSelectedSubscription((currentSelected) => {
        if (!currentSelected) {
          return result.find(isActiveSubscription) ?? result[0] ?? null;
        }

        return (
          result.find((subscription) => subscription.id === currentSelected.id) ??
          result.find(isActiveSubscription) ??
          result[0] ??
          null
        );
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load your subscriptions."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter(isActiveSubscription),
    [subscriptions]
  );

  const monthlyTotal = useMemo(
    () =>
      activeSubscriptions.reduce(
        (total, subscription) => total + toNumber(subscription.plan.monthly_price),
        0
      ),
    [activeSubscriptions]
  );

  async function handleSelectSubscription(subscription: MySubscription) {
    try {
      setLoadingDetailId(subscription.id);
      setErrorMessage(null);

      const detail = await getMySubscription(subscription.id);
      setSelectedSubscription(detail);

      setSubscriptions((currentSubscriptions) =>
        currentSubscriptions.map((item) =>
          item.id === detail.id ? detail : item
        )
      );
    } catch (error) {
      setSelectedSubscription(subscription);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load subscription details."
      );
    } finally {
      setLoadingDetailId(null);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.mutedText}>Loading subscriptions...</Text>
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
          onRefresh={() => void loadSubscriptions(true)}
        />
      }
    >
      <Text style={styles.eyebrow}>Subscriptions</Text>
      <Text style={styles.title}>My internet plans</Text>
      <Text style={styles.subtitle}>
        Review your current plans, limits, renewal state, and subscription status.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Subscription action failed</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Total</Text>
          <Text style={styles.bigNumber}>{subscriptions.length}</Text>
          <Text style={styles.smallText}>subscriptions</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Active</Text>
          <Text style={styles.bigNumber}>{activeSubscriptions.length}</Text>
          <Text style={styles.smallText}>currently running</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Monthly Active Total</Text>
        <Text style={styles.bigNumber}>${monthlyTotal.toFixed(2)}</Text>
        <Text style={styles.smallText}>
          Total price of active subscriptions in this account.
        </Text>
      </View>

      {selectedSubscription ? (
        <View style={styles.featuredCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <Text style={styles.cardLabel}>Selected Subscription</Text>
              <Text style={styles.cardTitle}>
                {selectedSubscription.subscription_label ??
                  selectedSubscription.plan.plan_name}
              </Text>
            </View>

            <Text
              style={[
                styles.statusPill,
                isActiveSubscription(selectedSubscription)
                  ? styles.activePill
                  : styles.inactivePill,
              ]}
            >
              {formatLabel(selectedSubscription.status)}
            </Text>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailBox}>
              <Text style={styles.metricLabel}>Plan</Text>
              <Text style={styles.metricValue}>
                {selectedSubscription.plan.plan_name}
              </Text>
            </View>

            <View style={styles.detailBox}>
              <Text style={styles.metricLabel}>Price</Text>
              <Text style={styles.metricValue}>
                {formatMoney(selectedSubscription.plan.monthly_price)}
              </Text>
            </View>

            <View style={styles.detailBox}>
              <Text style={styles.metricLabel}>Data limit</Text>
              <Text style={styles.metricValue}>
                {formatGb(selectedSubscription.plan.data_limit_gb)}
              </Text>
            </View>

            <View style={styles.detailBox}>
              <Text style={styles.metricLabel}>Speed</Text>
              <Text style={styles.metricValue}>
                {formatMbps(selectedSubscription.plan.speed_limit_mbps)}
              </Text>
            </View>
          </View>

          {selectedSubscription.plan.description ? (
            <Text style={styles.cardText}>
              {selectedSubscription.plan.description}
            </Text>
          ) : null}

          <View style={styles.metaList}>
            <Text style={styles.cardText}>
              Start:{" "}
              <Text style={styles.boldText}>
                {formatDate(selectedSubscription.start_date)}
              </Text>
            </Text>
            <Text style={styles.cardText}>
              End:{" "}
              <Text style={styles.boldText}>
                {formatDate(selectedSubscription.end_date)}
              </Text>
            </Text>
            <Text style={styles.cardText}>
              Auto renew:{" "}
              <Text style={styles.boldText}>
                {selectedSubscription.auto_renew ? "Yes" : "No"}
              </Text>
            </Text>
            <Text style={styles.smallText}>
              Last updated: {formatDateTime(selectedSubscription.updated_at)}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>All Subscriptions</Text>

        {subscriptions.length ? (
          subscriptions.map((subscription) => {
            const selected = selectedSubscription?.id === subscription.id;
            const loadingDetail = loadingDetailId === subscription.id;

            return (
              <Pressable
                key={subscription.id}
                style={[
                  styles.subscriptionRow,
                  selected && styles.selectedRow,
                ]}
                onPress={() => void handleSelectSubscription(subscription)}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleGroup}>
                    <Text style={styles.itemTitle}>
                      {subscription.subscription_label ??
                        subscription.plan.plan_name}
                    </Text>
                    <Text style={styles.smallText}>
                      {subscription.plan.plan_name}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.statusPill,
                      isActiveSubscription(subscription)
                        ? styles.activePill
                        : styles.inactivePill,
                    ]}
                  >
                    {formatLabel(subscription.status)}
                  </Text>
                </View>

                <View style={styles.rowMeta}>
                  <Text style={styles.cardText}>
                    {formatGb(subscription.plan.data_limit_gb)} -{" "}
                    {formatMoney(subscription.plan.monthly_price)}
                  </Text>
                  <Text style={styles.smallText}>
                    Ends: {formatDate(subscription.end_date)}
                  </Text>
                </View>

                <Text style={styles.rowActionText}>
                  {loadingDetail
                    ? "Loading details..."
                    : selected
                      ? "Selected"
                      : "Tap to view details"}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.mutedText}>
            No subscriptions were found for this account yet.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

export default SubscriptionsScreen;

function createStyles(colors: ReturnType<typeof usePulseFiTheme>["colors"]) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 24,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      gap: 16,
      padding: 20,
      backgroundColor: colors.background,
    },
    eyebrow: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    title: {
      fontSize: 28,
      fontWeight: "900",
      color: colors.text,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
    },
    summaryGrid: {
      flexDirection: "row",
      gap: 12,
    },
    summaryCard: {
      flex: 1,
      borderRadius: 22,
      padding: 16,
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    card: {
      borderRadius: 22,
      padding: 18,
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    featuredCard: {
      borderRadius: 24,
      padding: 18,
      gap: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    errorCard: {
      borderRadius: 18,
      padding: 16,
      gap: 6,
      backgroundColor: colors.dangerBackground,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    errorTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.dangerText,
    },
    errorText: {
      fontSize: 14,
      color: colors.dangerText,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionTitleGroup: {
      flex: 1,
      gap: 4,
    },
    cardLabel: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: colors.text,
    },
    itemTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: colors.text,
    },
    bigNumber: {
      fontSize: 34,
      fontWeight: "900",
      color: colors.text,
    },
    detailGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    detailBox: {
      width: "47%",
      borderRadius: 18,
      padding: 14,
      gap: 4,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textMuted,
    },
    metricValue: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
    },
    metaList: {
      gap: 6,
    },
    subscriptionRow: {
      borderRadius: 18,
      padding: 14,
      gap: 10,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectedRow: {
      borderColor: colors.primary,
    },
    rowMeta: {
      gap: 4,
    },
    rowActionText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    statusPill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
      overflow: "hidden",
      fontSize: 12,
      fontWeight: "900",
      textTransform: "capitalize",
    },
    activePill: {
      color: colors.successText,
      backgroundColor: colors.successBackground,
      borderColor: colors.successBorder,
    },
    inactivePill: {
      color: colors.textMuted,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
    },
    cardText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
    },
    boldText: {
      fontWeight: "900",
      color: colors.text,
    },
    smallText: {
      fontSize: 12,
      color: colors.textSubtle,
    },
    mutedText: {
      fontSize: 14,
      color: colors.textSubtle,
      textAlign: "center",
    },
  });
}
