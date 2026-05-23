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

import {
  getMyRouter,
  getMyRouterCapabilities,
  getMyRouters,
  getMySubscriptions,
} from "../api/appUser";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type {
  MyRouter,
  MyRouterCapabilities,
  MySubscription,
} from "../types/appUser";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getRouterDisplayName(router: MyRouter) {
  return router.router_name ?? router.router_model ?? "Unnamed router";
}

function getRouterModeLabel(capabilities: MyRouterCapabilities | null | undefined) {
  if (!capabilities) {
    return "Capabilities unavailable";
  }

  if (capabilities.is_simulator) {
    return "Simulator mode";
  }

  return `${formatLabel(capabilities.integration_mode)} mode`;
}

type RoutersScreenProps = {
  selectedRouterId?: string | null;
  onSelectedRouterChange?: (routerId: string | null) => void;
};

function capabilityRows(capabilities: MyRouterCapabilities | null | undefined) {
  if (!capabilities) {
    return [
      ["Capabilities", "Could not load", false] as const,
    ];
  }

  return [
    ["Read total usage", capabilities.can_read_total_usage ? "Supported" : "Not supported", capabilities.can_read_total_usage] as const,
    ["Read connected devices", capabilities.can_read_connected_devices ? "Supported" : "Not supported", capabilities.can_read_connected_devices] as const,
    ["Read device usage", capabilities.can_read_device_usage ? "Supported" : "Not supported", capabilities.can_read_device_usage] as const,
    ["Bandwidth limits", capabilities.can_apply_bandwidth_limit ? "Supported" : "Not supported", capabilities.can_apply_bandwidth_limit] as const,
    ["Device priority", capabilities.can_apply_device_priority ? "Supported" : "Not supported", capabilities.can_apply_device_priority] as const,
  ];
}

export function RoutersScreen({ selectedRouterId, onSelectedRouterChange }: RoutersScreenProps = {}) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [routers, setRouters] = useState<MyRouter[]>([]);
  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [selectedRouter, setSelectedRouter] = useState<MyRouter | null>(null);
  const [capabilitiesByRouterId, setCapabilitiesByRouterId] = useState<
    Record<string, MyRouterCapabilities | null>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRouters = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const [result, subscriptionResult] = await Promise.all([
        getMyRouters(),
        getMySubscriptions(),
      ]);

      const capabilityEntries = await Promise.all(
        result.map(async (router) => {
          try {
            const capabilities = await getMyRouterCapabilities(router.id);
            return [router.id, capabilities] as const;
          } catch {
            return [router.id, null] as const;
          }
        })
      );

      const capabilityMap =
        capabilityEntries.reduce<Record<string, MyRouterCapabilities | null>>(
          (current, [routerId, capabilities]) => ({
            ...current,
            [routerId]: capabilities,
          }),
          {}
        );

      setRouters(result);
      setSubscriptions(subscriptionResult);
      setCapabilitiesByRouterId(capabilityMap);

      setSelectedRouter((currentSelected) => {
        const sharedSelectedRouter = selectedRouterId
          ? result.find((router) => router.id === selectedRouterId)
          : null;

        if (sharedSelectedRouter) {
          return sharedSelectedRouter;
        }

        if (!currentSelected) {
          return result[0] ?? null;
        }

        return (
          result.find((router) => router.id === currentSelected.id) ??
          result[0] ??
          null
        );
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load your routers."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRouterId]);

  useEffect(() => {
    void loadRouters();
  }, [loadRouters]);

  // sync shared selected router when navigating back from another More section
  useEffect(() => {
    if (!selectedRouterId) {
      return;
    }

    const matchingRouter = routers.find((router) => router.id === selectedRouterId);

    if (matchingRouter) {
      setSelectedRouter(matchingRouter);
    }
  }, [routers, selectedRouterId]);

  const selectedCapabilities = selectedRouter
    ? capabilitiesByRouterId[selectedRouter.id]
    : null;

  const subscriptionById = useMemo(() => {
    return new Map(
      subscriptions.map((subscription) => [subscription.id, subscription])
    );
  }, [subscriptions]);

  function getRouterServiceLabel(router: MyRouter) {
    if (!router.user_subscription_id) {
      return "No service line linked";
    }

    const subscription = subscriptionById.get(router.user_subscription_id);

    if (!subscription) {
      return router.user_subscription_id;
    }

    return `${
      subscription.subscription_label ?? getRouterDisplayName(router)
    } / ${subscription.plan.plan_name} / ${formatLabel(subscription.status)}`;
  }

  const simulatorCount = useMemo(
    () =>
      routers.filter((router) => capabilitiesByRouterId[router.id]?.is_simulator)
        .length,
    [capabilitiesByRouterId, routers]
  );

  async function handleSelectRouter(router: MyRouter) {
    try {
      setLoadingDetailId(router.id);
      setErrorMessage(null);

      const [detail, capabilities] = await Promise.all([
        getMyRouter(router.id),
        getMyRouterCapabilities(router.id).catch(() => null),
      ]);

      setSelectedRouter(detail);
      onSelectedRouterChange?.(detail.id);
      setRouters((currentRouters) =>
        currentRouters.map((item) => (item.id === detail.id ? detail : item))
      );
      setCapabilitiesByRouterId((currentMap) => ({
        ...currentMap,
        [detail.id]: capabilities,
      }));
    } catch (error) {
      setSelectedRouter(router);
      onSelectedRouterChange?.(router.id);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load router details."
      );
    } finally {
      setLoadingDetailId(null);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.mutedText}>Loading routers...</Text>
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
          onRefresh={() => void loadRouters(true)}
        />
      }
    >
      <Text style={styles.eyebrow}>Routers</Text>
      <Text style={styles.title}>My router connections</Text>
      <Text style={styles.subtitle}>
        View routers linked to your subscriptions and check which network actions are supported.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Router action failed</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Total</Text>
          <Text style={styles.bigNumber}>{routers.length}</Text>
          <Text style={styles.smallText}>routers</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Simulator</Text>
          <Text style={styles.bigNumber}>{simulatorCount}</Text>
          <Text style={styles.smallText}>demo mode</Text>
        </View>
      </View>

      {selectedRouter ? (
        <View style={styles.featuredCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <Text style={styles.cardLabel}>Selected Router</Text>
              <Text style={styles.cardTitle}>
                {getRouterDisplayName(selectedRouter)}
              </Text>
            </View>

            <Text style={styles.statusPill}>
              {formatLabel(selectedRouter.status)}
            </Text>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailBox}>
              <Text style={styles.metricLabel}>Model</Text>
              <Text style={styles.metricValue}>
                {selectedRouter.router_model ?? "Unknown"}
              </Text>
            </View>

            <View style={styles.detailBox}>
              <Text style={styles.metricLabel}>Mode</Text>
              <Text style={styles.metricValue}>
                {getRouterModeLabel(selectedCapabilities)}
              </Text>
            </View>
          </View>

          <View style={styles.metaList}>
            <Text style={styles.cardText}>
              Service line:{" "}
              <Text style={styles.boldText}>
                {getRouterServiceLabel(selectedRouter)}
              </Text>
            </Text>
            <Text style={styles.smallText}>
              Created: {formatDateTime(selectedRouter.created_at)}
            </Text>
            <Text style={styles.smallText}>
              Updated: {formatDateTime(selectedRouter.updated_at)}
            </Text>
          </View>

          <View style={styles.capabilityList}>
            <Text style={styles.cardLabel}>Capabilities</Text>

            {capabilityRows(selectedCapabilities).map(([label, value, supported]) => (
              <View key={label} style={styles.capabilityRow}>
                <Text style={styles.cardText}>{label}</Text>
                <Text
                  style={[
                    styles.capabilityPill,
                    supported ? styles.supportedPill : styles.unsupportedPill,
                  ]}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>All Routers</Text>

        {routers.length ? (
          routers.map((router) => {
            const selected = selectedRouter?.id === router.id;
            const loadingDetail = loadingDetailId === router.id;
            const capabilities = capabilitiesByRouterId[router.id];

            return (
              <Pressable
                key={router.id}
                style={[styles.routerRow, selected && styles.selectedRow]}
                onPress={() => void handleSelectRouter(router)}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleGroup}>
                    <Text style={styles.itemTitle}>
                      {getRouterDisplayName(router)}
                    </Text>
                    <Text style={styles.smallText}>
                      {router.router_model ?? "Unknown model"}
                    </Text>
                    <Text style={styles.smallText}>
                      {getRouterServiceLabel(router)}
                    </Text>
                  </View>

                  <Text style={styles.statusPill}>
                    {formatLabel(router.status)}
                  </Text>
                </View>

                <View style={styles.rowMeta}>
                  <Text style={styles.cardText}>
                    {getRouterModeLabel(capabilities)}
                  </Text>
                  <Text style={styles.smallText}>
                    Updated: {formatDateTime(router.updated_at)}
                  </Text>
                </View>

                <Text style={styles.rowActionText}>
                  {loadingDetail
                    ? "Loading details..."
                    : selected
                      ? "Selected"
                      : "Tap to view capabilities"}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.mutedText}>
            No routers were found for this account yet.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

export default RoutersScreen;

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
    capabilityList: {
      gap: 10,
    },
    capabilityRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      borderRadius: 16,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    capabilityPill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
      overflow: "hidden",
      fontSize: 12,
      fontWeight: "900",
    },
    supportedPill: {
      color: colors.successText,
      backgroundColor: colors.successBackground,
      borderColor: colors.successBorder,
    },
    unsupportedPill: {
      color: colors.dangerText,
      backgroundColor: colors.dangerBackground,
      borderColor: colors.dangerBorder,
    },
    routerRow: {
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
      color: colors.primary,
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
