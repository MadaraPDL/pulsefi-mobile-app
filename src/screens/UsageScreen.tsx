import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Svg, { Circle } from "react-native-svg";

import {
  getMyRouters,
  getMySubscriptions,
  getMyUsageRecords,
  getMyUsageSummary,
  getMyDeviceUsageList,
} from "../api/appUser";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import { useSelectedRouter } from "../state/SelectedRouterContext";
import type {
  DecimalLike,
  MyRouter,
  MySubscription,
  MyUsageRecord,
  MyUsageSummary,
  MyDeviceUsage,
} from "../types/appUser";

type UsageData = {
  summary: MyUsageSummary;
  records: MyUsageRecord[];
  deviceUsage: MyDeviceUsage[];
  routers: MyRouter[];
  subscriptions: MySubscription[];
};

type UsageFilter = "all" | "official" | "estimated";
type UsageBreakdownMode = "download" | "upload";

const usageFilters: { key: UsageFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "official", label: "Official" },
  { key: "estimated", label: "Estimated" },
];

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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatSource(value: string | null) {
  if (!value) {
    return "Unknown source";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getUsageRecordKind(record: MyUsageRecord): Exclude<UsageFilter, "all"> {
  return record.device_id ? "estimated" : "official";
}

function getUsageKindLabel(kind: Exclude<UsageFilter, "all">) {
  if (kind === "official") {
    return "Official subscription usage";
  }

  return "Estimated per-device usage";
}

function getUsageKindHelp(kind: Exclude<UsageFilter, "all">) {
  if (kind === "official") {
    return "This is the subscription-level usage that should come from the ISP system, RADIUS, or ISP API.";
  }

  return "This is device-level usage estimated from router/CPE data when the router supports device visibility.";
}


function getDeviceDisplayName(device: MyDeviceUsage) {
  return device.device_name ?? device.mac_address ?? "Unknown device";
}

function getDeviceUsageValue(device: MyDeviceUsage, mode: UsageBreakdownMode) {
  return mode === "download"
    ? toNumber(device.usage.download_mb)
    : toNumber(device.usage.upload_mb);
}

function getRouterDisplayName(router: MyRouter | null) {
  return router?.router_name ?? router?.router_model ?? "No router selected";
}

function sumUsageRecords(records: MyUsageRecord[]) {
  return records.reduce(
    (totals, record) => ({
      total_mb: totals.total_mb + toNumber(record.total_mb),
      download_mb: totals.download_mb + toNumber(record.download_mb),
      upload_mb: totals.upload_mb + toNumber(record.upload_mb),
      record_count: totals.record_count + 1,
    }),
    {
      total_mb: 0,
      download_mb: 0,
      upload_mb: 0,
      record_count: 0,
    }
  );
}


function CircularUsageGraph({
  usedMb,
  limitGb,
}: {
  usedMb: number;
  limitGb: number | null;
}) {
  const { colors } = usePulseFiTheme();
  const size = 168;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const limitMb = limitGb && limitGb > 0 ? limitGb * 1024 : null;
  const percent = limitMb ? Math.min((usedMb / limitMb) * 100, 100) : 0;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <View style={styles.circularUsageWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      <View style={styles.circularUsageCenter}>
        <Text style={[styles.circularUsagePercent, { color: colors.text }]}>
          {limitMb ? `${Math.round(percent)}%` : "--"}
        </Text>
        <Text style={[styles.circularUsageLabel, { color: colors.textSubtle }]}>
          of plan
        </Text>
      </View>
    </View>
  );
}

export function UsageScreen() {
  const { colors } = usePulseFiTheme();
  const { selectedRouterId, setSelectedRouterId } = useSelectedRouter();
  const primaryActionBackground =
    colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE";
  const primaryActionText = colors.mode === "dark" ? colors.primary : "#0B5D7A";
  const [data, setData] = useState<UsageData | null>(null);
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [breakdownMode, setBreakdownMode] =
    useState<UsageBreakdownMode>("download");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUsage = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const [routers, subscriptions] = await Promise.all([
        getMyRouters(),
        getMySubscriptions(),
      ]);

      const matchingRouter = selectedRouterId
        ? routers.find((router) => router.id === selectedRouterId)
        : null;

      const fallbackRouter =
        routers.find((router) => router.user_subscription_id) ??
        routers[0] ??
        null;

      const effectiveRouterId = matchingRouter?.id ?? fallbackRouter?.id ?? null;

      if (effectiveRouterId && selectedRouterId !== effectiveRouterId) {
        setSelectedRouterId(effectiveRouterId);
      }

      const [summary, records, deviceUsage] = await Promise.all([
        getMyUsageSummary(effectiveRouterId),
        getMyUsageRecords(100, effectiveRouterId),
        getMyDeviceUsageList(50, effectiveRouterId),
      ]);

      setData({ summary, records, deviceUsage, routers, subscriptions });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load usage data."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRouterId, setSelectedRouterId]);
  useFocusEffect(
    useCallback(() => {
      void loadUsage();

      const refreshTimer = setInterval(() => {
        void loadUsage();
      }, 30000);

      return () => clearInterval(refreshTimer);
    }, [loadUsage])
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

  const selectedRouterIdLabel = selectedRouter
    ? `${getRouterDisplayName(selectedRouter)} · ${selectedRouter.id.slice(0, 8)}`
    : "No router selected";

  const selectedSubscription = useMemo(() => {
    if (!selectedRouter?.user_subscription_id) {
      return null;
    }

    return (
      data?.subscriptions.find(
        (subscription) => subscription.id === selectedRouter.user_subscription_id
      ) ?? null
    );
  }, [data?.subscriptions, selectedRouter]);

  const selectedPlanLimitGb = selectedSubscription
    ? toNumber(selectedSubscription.plan.data_limit_gb)
    : null;

  const records = selectedRouter
    ? (data?.records ?? []).filter((record) => record.router_id === selectedRouter.id)
    : data?.records ?? [];
  const selectedRouterTotals = useMemo(
    () => sumUsageRecords(records),
    [records]
  );

  const selectedDeviceUsage = useMemo(() => {
    const list = selectedRouter
      ? (data?.deviceUsage ?? []).filter(
          (device) => device.router_id === selectedRouter.id
        )
      : data?.deviceUsage ?? [];

    return [...list].sort(
      (left, right) =>
        getDeviceUsageValue(right, breakdownMode) -
        getDeviceUsageValue(left, breakdownMode)
    );
  }, [breakdownMode, data?.deviceUsage, selectedRouter]);

  const maxDeviceUsageValue = selectedDeviceUsage.reduce(
    (max, device) => Math.max(max, getDeviceUsageValue(device, breakdownMode)),
    0
  );


  const officialRecords = records.filter(
    (record) => getUsageRecordKind(record) === "official"
  );
  const estimatedRecords = records.filter(
    (record) => getUsageRecordKind(record) === "estimated"
  );

  const filteredRecords = records.filter((record) => {
    if (usageFilter === "all") {
      return true;
    }

    return getUsageRecordKind(record) === usageFilter;
  });

  const filteredTotalMb = filteredRecords.reduce(
    (total, record) => total + toNumber(record.total_mb),
    0
  );

  function getFilterCount(filter: UsageFilter) {
    if (filter === "all") {
      return records.length;
    }

    return filter === "official"
      ? officialRecords.length
      : estimatedRecords.length;
  }

  if (isLoading && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
          Loading usage data...
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
          onRefresh={() => void loadUsage(true)}
        />
      }
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>Usage</Text>
      <Text style={[styles.title, { color: colors.text }]}>Usage history</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Track usage for the currently selected router/service line.
      </Text>

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
            Could not refresh usage
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
        <Text style={[styles.recordTitle, { color: colors.text }]}>
          {getRouterDisplayName(selectedRouter)}
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Service line:{" "}
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {selectedSubscription?.subscription_label ??
              getRouterDisplayName(selectedRouter)}
          </Text>
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Package:{" "}
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {selectedSubscription?.plan.plan_name ?? "Unknown package"}
          </Text>
        </Text>
      </View>

      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.infoTitle, { color: colors.text }]}>
          Usage source guide
        </Text>
        <Text style={[styles.infoText, { color: colors.textMuted }]}>
          Official usage is the subscription total from the ISP system,
          RADIUS, or ISP API. Estimated usage is per-device data from the
          router/CPE layer and may be approximate.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Selected Router Usage Summary
        </Text>
        <CircularUsageGraph
          usedMb={selectedRouterTotals.total_mb}
          limitGb={selectedPlanLimitGb}
        />

        <Text style={[styles.bigNumber, { color: colors.text }]}>
          {formatMb(selectedRouterTotals.total_mb)}
        </Text>

        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          {selectedPlanLimitGb
            ? `Used from ${selectedPlanLimitGb} GB package`
            : "No package limit available"}
        </Text>

        <View style={styles.metricRow}>
          <Pressable
            onPress={() => setBreakdownMode("download")}
            style={[
              styles.metricBox,
              {
                backgroundColor:
                  breakdownMode === "download"
                    ? primaryActionBackground
                    : colors.surfaceMuted,
                borderColor:
                  breakdownMode === "download" ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.metricLabel,
                {
                  color:
                    breakdownMode === "download"
                      ? primaryActionText
                      : colors.textMuted,
                },
              ]}
            >
              Download
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatMb(selectedRouterTotals.download_mb)}
            </Text>
            <Text style={[styles.metricHint, { color: colors.textSubtle }]}>
              Tap for devices
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setBreakdownMode("upload")}
            style={[
              styles.metricBox,
              {
                backgroundColor:
                  breakdownMode === "upload"
                    ? primaryActionBackground
                    : colors.surfaceMuted,
                borderColor:
                  breakdownMode === "upload" ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.metricLabel,
                {
                  color:
                    breakdownMode === "upload"
                      ? primaryActionText
                      : colors.textMuted,
                },
              ]}
            >
              Upload
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatMb(selectedRouterTotals.upload_mb)}
            </Text>
            <Text style={[styles.metricHint, { color: colors.textSubtle }]}>
              Tap for devices
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          Records for selected router: {selectedRouterTotals.record_count}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.recordHeader}>
          <View style={styles.deviceUsageTitleGroup}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
              {breakdownMode === "download"
                ? "Download by device"
                : "Upload by device"}
            </Text>
            <Text style={[styles.smallText, { color: colors.textSubtle }]}>
              Current totals known to PulseFi. Refreshes every 30 seconds while
              this screen is open.
            </Text>
          </View>
        </View>

        {selectedDeviceUsage.length ? (
          selectedDeviceUsage.map((device) => {
            const value = getDeviceUsageValue(device, breakdownMode);
            const percent =
              maxDeviceUsageValue > 0
                ? Math.min((value / maxDeviceUsageValue) * 100, 100)
                : 0;

            return (
              <View
                key={device.id}
                style={[
                  styles.deviceUsageRow,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.deviceUsageTopLine}>
                  <View style={styles.deviceUsageNameGroup}>
                    <Text style={[styles.deviceUsageName, { color: colors.text }]}>
                      {getDeviceDisplayName(device)}
                    </Text>
                    <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                      {device.ip_address ?? device.mac_address}
                    </Text>
                  </View>

                  <Text style={[styles.deviceUsageValue, { color: colors.text }]}>
                    {formatMb(value)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.deviceUsageBarTrack,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.deviceUsageBarFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${percent}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No per-device usage is available for this router yet.
          </Text>
        )}
      </View>

      <View style={styles.filterHeader}>
        <View>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            Record Filters
          </Text>
          <Text style={[styles.smallText, { color: colors.textSubtle }]}>
            Showing {filteredRecords.length} records · {formatMb(filteredTotalMb)}
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {usageFilters.map((option) => {
          const isSelected = usageFilter === option.key;

          return (
            <Pressable
              key={option.key}
              onPress={() => setUsageFilter(option.key)}
              style={({ pressed }) => [
                styles.filterButton,
                {
                  backgroundColor: isSelected
                    ? primaryActionBackground
                    : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: isSelected ? primaryActionText : colors.textMuted,
                  },
                ]}
              >
                {option.label} ({getFilterCount(option.key)})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Latest Records
        </Text>

        {filteredRecords.length ? (
          filteredRecords.map((record) => {
            const kind = getUsageRecordKind(record);

            return (
              <View
                key={record.id}
                style={[
                  styles.recordRow,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.recordHeader}>
                  <Text style={[styles.recordTitle, { color: colors.text }]}>
                    {formatMb(record.total_mb)}
                  </Text>
                  <Text
                    style={[
                      styles.recordBadge,
                      {
                        backgroundColor:
                          kind === "official"
                            ? colors.successBackground
                            : colors.surface,
                        borderColor:
                          kind === "official"
                            ? colors.successBorder
                            : colors.border,
                        color:
                          kind === "official"
                            ? colors.successText
                            : colors.primary,
                      },
                    ]}
                  >
                    {kind === "official" ? "Official" : "Estimated"}
                  </Text>
                </View>

                <Text style={[styles.recordKind, { color: colors.text }]}>
                  {getUsageKindLabel(kind)}
                </Text>

                <Text style={[styles.cardText, { color: colors.textMuted }]}>
                  Download: {formatMb(record.download_mb)} · Upload:{" "}
                  {formatMb(record.upload_mb)}
                </Text>

                <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                  Source: {formatSource(record.source)}
                </Text>

                <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                  {getUsageKindHelp(kind)}
                </Text>

                <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                  {formatDateTime(record.record_start)} to{" "}
                  {formatDateTime(record.record_end)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No records match this filter. Pull to refresh or run simulator
            ingestion from the ISP Admin dashboard.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

export default UsageScreen;

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
  infoCard: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
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
    fontWeight: "800",
    color: "#6B7888",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#102033",
  },
  metricHint: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  deviceUsageTitleGroup: {
    flex: 1,
    gap: 4,
  },
  deviceUsageRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  deviceUsageTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  deviceUsageNameGroup: {
    flex: 1,
    gap: 2,
  },
  deviceUsageName: {
    fontSize: 14,
    fontWeight: "900",
  },
  deviceUsageValue: {
    fontSize: 14,
    fontWeight: "900",
  },
  deviceUsageBarTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  deviceUsageBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterButton: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "900",
  },
  recordRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    gap: 7,
  },
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#102033",
  },
  recordBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
  },
  recordKind: {
    fontSize: 14,
    fontWeight: "900",
  },
  cardText: {
    fontSize: 15,
    color: "#33465B",
  },
  smallText: {
    fontSize: 12,
    color: "#6B7888",
  },
  circularUsageWrap: {
    alignSelf: "center",
    width: 168,
    height: 168,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  circularUsageCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  circularUsagePercent: {
    fontSize: 30,
    fontWeight: "900",
  },
  circularUsageLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  mutedText: {
    fontSize: 14,
    color: "#6B7888",
    textAlign: "center",
  },
});
