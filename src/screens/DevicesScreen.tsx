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
  createBandwidthLimitPolicy,
  createDevicePriorityPolicy,
  executeMyDevicePolicy,
  getMyDevicePolicies,
  getMyDevices,
  getMyDeviceUsageList,
} from "../api/appUser";
import type {
  DecimalLike,
  MyDevice,
  MyDevicePolicy,
  MyDeviceUsage,
  MyUsageTotals,
} from "../types/appUser";

type DevicesData = {
  devices: MyDevice[];
  deviceUsage: MyDeviceUsage[];
  policies: MyDevicePolicy[];
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

function formatMbps(value: DecimalLike | null) {
  if (value === null) {
    return "Not set";
  }

  return `${toNumber(value).toFixed(0)} Mbps`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not seen yet";
  }

  return new Date(value).toLocaleString();
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
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

function DevicePolicies({ policies }: { policies: MyDevicePolicy[] }) {
  if (!policies.length) {
    return <Text style={styles.smallText}>No policies created for this device.</Text>;
  }

  return (
    <View style={styles.policyList}>
      {policies.map((policy) => (
        <View key={policy.id} style={styles.policyRow}>
          <Text style={styles.policyTitle}>{formatLabel(policy.policy_type)}</Text>
          <Text style={styles.smallText}>
            Status: {formatLabel(policy.status)} · Active:{" "}
            {policy.is_active ? "Yes" : "No"}
          </Text>

          {policy.policy_type === "bandwidth_limit" ? (
            <Text style={styles.smallText}>
              Limit: {formatMbps(policy.bandwidth_limit_mbps)}
            </Text>
          ) : null}

          {policy.policy_type === "device_priority" ? (
            <Text style={styles.smallText}>
              Priority level: {policy.priority_level ?? "Not set"}
            </Text>
          ) : null}

          {policy.failure_reason ? (
            <Text style={styles.failureText}>{policy.failure_reason}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function DevicesScreen() {
  const [data, setData] = useState<DevicesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workingDeviceId, setWorkingDeviceId] = useState<string | null>(null);
  const [workingPolicyId, setWorkingPolicyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadDevices = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const [devices, deviceUsage, policies] = await Promise.all([
        getMyDevices(50),
        getMyDeviceUsageList(50),
        getMyDevicePolicies(50),
      ]);

      setData({ devices, deviceUsage, policies });
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

  const policiesByDeviceId = useMemo(() => {
    const map = new Map<string, MyDevicePolicy[]>();

    for (const policy of data?.policies ?? []) {
      const current = map.get(policy.device_id) ?? [];
      current.push(policy);
      map.set(policy.device_id, current);
    }

    return map;
  }, [data?.policies]);

  async function createAndAddPolicy(
    deviceId: string,
    createPolicy: (deviceId: string) => Promise<MyDevicePolicy>,
    successText: string
  ) {
    try {
      setWorkingDeviceId(deviceId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const policy = await createPolicy(deviceId);

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          policies: [policy, ...current.policies],
        };
      });

      setSuccessMessage(successText);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create device policy."
      );
    } finally {
      setWorkingDeviceId(null);
    }
  }

  async function handleExecutePolicy(policyId: string) {
    try {
      setWorkingPolicyId(policyId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const execution = await executeMyDevicePolicy(policyId);

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          policies: current.policies.map((policy) =>
            policy.id === execution.policy.id ? execution.policy : policy
          ),
        };
      });

      setSuccessMessage(execution.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not execute policy."
      );
    } finally {
      setWorkingPolicyId(null);
    }
  }

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
        View your devices, usage totals, and demo router policies.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Device action failed</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Action completed</Text>
          <Text style={styles.successText}>{successMessage}</Text>
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
            const policies = policiesByDeviceId.get(device.id) ?? [];
            const pendingPolicies = policies.filter(
              (policy) => policy.status === "pending"
            );
            const isWorkingOnDevice = workingDeviceId === device.id;

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

                <View style={styles.actionGrid}>
                  <Pressable
                    disabled={isWorkingOnDevice}
                    style={[
                      styles.secondaryButton,
                      isWorkingOnDevice && styles.buttonDisabled,
                    ]}
                    onPress={() =>
                      void createAndAddPolicy(
                        device.id,
                        (targetDeviceId) =>
                          createBandwidthLimitPolicy(targetDeviceId, 10),
                        "Bandwidth limit policy created. Execute it to apply."
                      )
                    }
                  >
                    <Text style={styles.secondaryButtonText}>
                      {isWorkingOnDevice ? "Working..." : "Limit 10 Mbps"}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={isWorkingOnDevice}
                    style={[
                      styles.secondaryButton,
                      isWorkingOnDevice && styles.buttonDisabled,
                    ]}
                    onPress={() =>
                      void createAndAddPolicy(
                        device.id,
                        (targetDeviceId) =>
                          createDevicePriorityPolicy(targetDeviceId, 8),
                        "Priority policy created. Execute it to apply."
                      )
                    }
                  >
                    <Text style={styles.secondaryButtonText}>
                      {isWorkingOnDevice ? "Working..." : "High priority"}
                    </Text>
                  </Pressable>
                </View>

                {pendingPolicies.length ? (
                  <View style={styles.pendingBox}>
                    <Text style={styles.policyTitle}>Pending policy actions</Text>
                    {pendingPolicies.map((policy) => {
                      const isExecuting = workingPolicyId === policy.id;

                      return (
                        <Pressable
                          key={policy.id}
                          disabled={isExecuting}
                          style={[
                            styles.primaryButton,
                            isExecuting && styles.buttonDisabled,
                          ]}
                          onPress={() => void handleExecutePolicy(policy.id)}
                        >
                          <Text style={styles.primaryButtonText}>
                            {isExecuting
                              ? "Executing..."
                              : `Execute ${formatLabel(policy.policy_type)}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                <DevicePolicies policies={policies} />
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
  successCard: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
    backgroundColor: "#E9F8EF",
    borderWidth: 1,
    borderColor: "#BFECCF",
  },
  successTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0B6B3A",
  },
  successText: {
    fontSize: 14,
    color: "#0B6B3A",
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
  actionGrid: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: "#102033",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: "#EAF9FE",
  },
  secondaryButtonText: {
    color: "#0B5D7A",
    fontSize: 13,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  pendingBox: {
    gap: 8,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#F6F8FB",
  },
  policyList: {
    gap: 8,
  },
  policyRow: {
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: "#F6F8FB",
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#102033",
    textTransform: "capitalize",
  },
  failureText: {
    fontSize: 12,
    color: "#8A2E1B",
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
