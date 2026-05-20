import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getMyDevices, getMyDeviceUsageList } from "../api/appUser";
import type {
  DecimalLike,
  MyDevice,
  MyDeviceUsage,
  MyUsageTotals,
} from "../types/appUser";

type DevicesData = {
  devices: MyDevice[];
  deviceUsage: MyDeviceUsage[];
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not seen yet";
  }

  return new Date(value).toLocaleString();
}

function getDeviceDisplayName(device: MyDevice) {
  return device.device_name ?? device.device_type ?? "Unnamed device";
}

function DeviceUsageSummary({ usage }: { usage?: MyUsageTotals }) {
  if (!usage) {
    return (
      <Text style={styles.smallText}>
        No usage totals found for this device yet.
      </Text>
    );
  }

  return (
    <View style={styles.usageGrid}>
      <View style={styles.usageBox}>
        <Text style={styles.metricLabel}>Total</Text>
        <Text style={styles.metricValue}>{formatMb(usage.total_mb)}</Text>
      </View>
      <View style={styles.usageBox}>
        <Text style={styles.metricLabel}>Download</Text>
        <Text style={styles.metricValue}>{formatMb(usage.download_mb)}</Text>
      </View>
      <View style={styles.usageBox}>
        <Text style={styles.metricLabel}>Upload</Text>
        <Text style={styles.metricValue}>{formatMb(usage.upload_mb)}</Text>
      </View>
    </View>
  );
}

export function DevicesScreen() {
  const [data, setData] = useState<DevicesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDevices = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const [devices, deviceUsage] = await Promise.all([
        getMyDevices(50),
        getMyDeviceUsageList(50),
      ]);

      setData({ devices, deviceUsage });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load your devices."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const usageByDeviceId = useMemo(() => {
    const map = new Map<string, MyDeviceUsage>();

    for (const item of data?.deviceUsage ?? []) {
      map.set(item.id, item);
    }

    return map;
  }, [data?.deviceUsage]);

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.mutedText}>Loading connected devices...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadDevices(true)}
        />
      }
    >
      <Text style={styles.eyebrow}>Devices</Text>
      <Text style={styles.title}>Connected devices</Text>
      <Text style={styles.subtitle}>
        View your known devices and their usage totals.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not refresh devices</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Overview</Text>
        <Text style={styles.bigNumber}>{data?.devices.length ?? 0}</Text>
        <Text style={styles.cardText}>known devices on your account</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Device List</Text>

        {data?.devices.length ? (
          data.devices.map((device) => {
            const usage = usageByDeviceId.get(device.id)?.usage;

            return (
              <View key={device.id} style={styles.deviceRow}>
                <View style={styles.deviceHeader}>
                  <View style={styles.deviceTitleGroup}>
                    <Text style={styles.deviceTitle}>
                      {getDeviceDisplayName(device)}
                    </Text>
                    <Text style={styles.smallText}>{device.mac_address}</Text>
                  </View>

                  <Text
                    style={[
                      styles.statusPill,
                      device.is_trusted
                        ? styles.trustedPill
                        : styles.untrustedPill,
                    ]}
                  >
                    {device.is_trusted ? "Trusted" : "Untrusted"}
                  </Text>
                </View>

                <View style={styles.detailGrid}>
                  <Text style={styles.cardText}>
                    Status: <Text style={styles.boldText}>{device.status}</Text>
                  </Text>
                  <Text style={styles.cardText}>
                    IP:{" "}
                    <Text style={styles.boldText}>
                      {device.ip_address ?? "Unknown"}
                    </Text>
                  </Text>
                  <Text style={styles.cardText}>
                    Type:{" "}
                    <Text style={styles.boldText}>
                      {device.device_type ?? "Unknown"}
                    </Text>
                  </Text>
                  <Text style={styles.cardText}>
                    Last seen:{" "}
                    <Text style={styles.boldText}>
                      {formatDateTime(device.last_seen)}
                    </Text>
                  </Text>
                </View>

                <DeviceUsageSummary usage={usage} />
              </View>
            );
          })
        ) : (
          <Text style={styles.mutedText}>
            No devices found yet. Run simulator device ingestion from the ISP
            Admin dashboard to generate demo device data.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

export default DevicesScreen;

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
    color: "#33465B",
  },
  boldText: {
    fontWeight: "900",
    color: "#102033",
  },
  deviceRow: {
    borderTopWidth: 1,
    borderTopColor: "#E3EAF2",
    paddingTop: 14,
    gap: 12,
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  deviceTitleGroup: {
    flex: 1,
    gap: 4,
  },
  deviceTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#102033",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
  },
  trustedPill: {
    color: "#0B6B3A",
    backgroundColor: "#E9F8EF",
  },
  untrustedPill: {
    color: "#8A5B00",
    backgroundColor: "#FFF5D7",
  },
  detailGrid: {
    gap: 4,
  },
  usageGrid: {
    flexDirection: "row",
    gap: 8,
  },
  usageBox: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#F6F8FB",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7888",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#102033",
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
