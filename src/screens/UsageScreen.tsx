import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getMyUsageRecords, getMyUsageSummary } from "../api/appUser";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type {
  DecimalLike,
  MyUsageRecord,
  MyUsageSummary,
} from "../types/appUser";

type UsageData = {
  summary: MyUsageSummary;
  records: MyUsageRecord[];
};

type UsageFilter = "all" | "official" | "estimated";

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

export function UsageScreen() {
  const { colors } = usePulseFiTheme();
  const primaryActionBackground =
    colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE";
  const primaryActionText = colors.mode === "dark" ? colors.primary : "#0B5D7A";
  const [data, setData] = useState<UsageData | null>(null);
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
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

      const [summary, records] = await Promise.all([
        getMyUsageSummary(),
        getMyUsageRecords(50),
      ]);

      setData({ summary, records });
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
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const records = data?.records ?? [];
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
        Track your official subscription usage separately from estimated
        per-device usage.
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
          Official Usage Summary
        </Text>
        <Text style={[styles.bigNumber, { color: colors.text }]}>
          {data ? formatMb(data.summary.totals.total_mb) : "0 MB"}
        </Text>

        <View style={styles.metricRow}>
          <View
            style={[
              styles.metricBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
              Download
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {data ? formatMb(data.summary.totals.download_mb) : "0 MB"}
            </Text>
          </View>

          <View
            style={[
              styles.metricBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
              Upload
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {data ? formatMb(data.summary.totals.upload_mb) : "0 MB"}
            </Text>
          </View>
        </View>

        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          Records in summary: {data?.summary.totals.record_count ?? 0}
        </Text>
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
  mutedText: {
    fontSize: 14,
    color: "#6B7888",
    textAlign: "center",
  },
});
