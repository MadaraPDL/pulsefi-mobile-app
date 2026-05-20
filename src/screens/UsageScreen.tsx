import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { usePulseFiTheme } from "../theme/usePulseFiTheme";

import { getMyUsageRecords, getMyUsageSummary } from "../api/appUser";
import type {
  DecimalLike,
  MyUsageRecord,
  MyUsageSummary,
} from "../types/appUser";

type UsageData = {
  summary: MyUsageSummary;
  records: MyUsageRecord[];
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function UsageScreen() {
  const { colors } = usePulseFiTheme();
  const [data, setData] = useState<UsageData | null>(null);
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
        getMyUsageRecords(20),
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

  if (isLoading && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>Loading usage data...</Text>
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
          onRefresh={() => void loadUsage(true)}
        />
      }
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>Usage</Text>
      <Text style={[styles.title, { color: colors.text }]}>Usage history</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Track your total internet consumption and latest usage records.
      </Text>

      {errorMessage ? (
        <View style={[styles.errorCard, { backgroundColor: colors.dangerBackground, borderColor: colors.dangerBorder }]}>
          <Text style={[styles.errorTitle, { color: colors.dangerText }]}>Could not refresh usage</Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Total Usage</Text>
        <Text style={[styles.bigNumber, { color: colors.text }]}>
          {data ? formatMb(data.summary.totals.total_mb) : "0 MB"}
        </Text>

        <View style={styles.metricRow}>
          <View style={[styles.metricBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Download</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {data ? formatMb(data.summary.totals.download_mb) : "0 MB"}
            </Text>
          </View>

          <View style={[styles.metricBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Upload</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {data ? formatMb(data.summary.totals.upload_mb) : "0 MB"}
            </Text>
          </View>
        </View>

        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          Records: {data?.summary.totals.record_count ?? 0}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Latest Records</Text>

        {data?.records.length ? (
          data.records.map((record) => (
            <View key={record.id} style={[styles.recordRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderTopColor: colors.border, borderTopWidth: 0, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 10 }]}>
              <View style={styles.recordHeader}>
                <Text style={[styles.recordTitle, { color: colors.text }]}>
                  {formatMb(record.total_mb)}
                </Text>
                <Text style={[styles.recordSource, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.primary }]}>
                  {record.source ?? "unknown"}
                </Text>
              </View>

              <Text style={[styles.cardText, { color: colors.textMuted }]}>
                Download: {formatMb(record.download_mb)} · Upload:{" "}
                {formatMb(record.upload_mb)}
              </Text>

              <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                {formatDateTime(record.record_start)} →{" "}
                {formatDateTime(record.record_end)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No usage records were found yet. Run simulator ingestion from the ISP
            Admin dashboard to generate demo usage data.
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
  recordRow: {
    borderTopWidth: 1,
    borderTopColor: "#E3EAF2",
    paddingTop: 12,
    gap: 6,
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
  recordSource: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "800",
    color: "#00A7D8",
    backgroundColor: "#EAF9FE",
    overflow: "hidden",
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
