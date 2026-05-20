import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { usePulseFiTheme } from "../theme/usePulseFiTheme";

import {
  createBandwidthLimitPolicy,
  createDevicePriorityPolicy,
  executeMyDevicePolicy,
  getMyDevice,
  getMyDevicePolicies,
  getMyDevicePolicy,
  getMyDevices,
  getMyDeviceUsage,
  getMyDeviceUsageList,
  getMyRouterCapabilities,
  updateMyDeviceTrust,
} from "../api/appUser";
import type {
  DecimalLike,
  MyDevice,
  MyDevicePolicy,
  MyDeviceUsage,
  MyRouterCapabilities,
  MyUsageTotals,
} from "../types/appUser";

type DevicesData = {
  devices: MyDevice[];
  deviceUsage: MyDeviceUsage[];
  policies: MyDevicePolicy[];
  routerCapabilities: Record<string, MyRouterCapabilities | null>;
};

type LimitDraft = {
  downloadLimitMbps: string;
  uploadLimitMbps: string;
};

type DeviceDetail = {
  device: MyDevice;
  usage: MyDeviceUsage | null;
};

function toNumber(value: DecimalLike | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

function getRouterModeLabel(capabilities: MyRouterCapabilities | null | undefined) {
  if (!capabilities) {
    return "Capabilities unavailable";
  }

  if (capabilities.is_simulator) {
    return "Simulator mode";
  }

  return `${formatLabel(capabilities.integration_mode)} mode`;
}

function getCapabilityHelpText(
  capabilities: MyRouterCapabilities | null | undefined,
  actionName: "bandwidth" | "priority"
) {
  if (!capabilities) {
    return "Router capabilities could not be loaded. Pull down to refresh and try again.";
  }

  if (actionName === "bandwidth") {
    return "This router does not support bandwidth limits, so PulseFi cannot apply this action here.";
  }

  return "This router does not support device priority, so PulseFi cannot apply this action here.";
}

function DeviceUsageSummary({ usage }: { usage?: MyUsageTotals }) {
  const { colors } = usePulseFiTheme();

  if (!usage) {
    return (
      <Text style={[styles.smallText, { color: colors.textSubtle }]}>
        No usage totals found for this device yet.
      </Text>
    );
  }

  return (
    <View style={styles.usageGrid}>
      <View style={[styles.usageBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Total</Text>
        <Text style={[styles.metricValue, { color: colors.text }]}>{formatMb(usage.total_mb)}</Text>
      </View>
      <View style={[styles.usageBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Download</Text>
        <Text style={[styles.metricValue, { color: colors.text }]}>{formatMb(usage.download_mb)}</Text>
      </View>
      <View style={[styles.usageBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Upload</Text>
        <Text style={[styles.metricValue, { color: colors.text }]}>{formatMb(usage.upload_mb)}</Text>
      </View>
    </View>
  );
}

function DevicePolicies({
  policies,
  selectedPolicyDetail,
  loadingPolicyDetailId,
  onViewPolicyDetail,
}: {
  policies: MyDevicePolicy[];
  selectedPolicyDetail: MyDevicePolicy | null;
  loadingPolicyDetailId: string | null;
  onViewPolicyDetail: (policyId: string) => void;
}) {
  const { colors } = usePulseFiTheme();

  if (!policies.length) {
    return (
      <Text style={[styles.smallText, { color: colors.textSubtle }]}>
        No policies created for this device.
      </Text>
    );
  }

  return (
    <View style={styles.policyList}>
      {policies.map((policy) => {
        const selected = selectedPolicyDetail?.id === policy.id;
        const detailPolicy = selected ? selectedPolicyDetail : policy;
        const isLoadingDetail = loadingPolicyDetailId === policy.id;

        return (
          <View
            key={policy.id}
            style={[
              styles.policyRow,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: selected ? colors.primary : colors.border,
                borderTopColor: colors.border,
                borderTopWidth: 0,
                borderWidth: 1,
                borderRadius: 18,
                padding: 14,
                marginTop: 10,
              },
            ]}
          >
            <Text style={[styles.policyTitle, { color: colors.text }]}>
              {formatLabel(policy.policy_type)}
            </Text>
            <Text style={[styles.smallText, { color: colors.textSubtle }]}>
              Status: {formatLabel(policy.status)} ? Active:{" "}
              {policy.is_active ? "Yes" : "No"}
            </Text>

            {policy.policy_type === "bandwidth_limit" ? (
              <>
                <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                  Download limit: {formatMbps(policy.download_limit_mbps)}
                </Text>
                <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                  Upload limit: {formatMbps(policy.upload_limit_mbps)}
                </Text>
              </>
            ) : null}

            {policy.policy_type === "device_priority" ? (
              <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                Priority level: {policy.priority_level ?? "Not set"}
              </Text>
            ) : null}

            {selected ? (
              <View
                style={{
                  borderRadius: 16,
                  padding: 12,
                  gap: 6,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.primary,
                }}
              >
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
                  Policy details
                </Text>
                <Text style={[styles.cardText, { color: colors.textMuted }]}>
                  Policy ID:{" "}
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {detailPolicy.id}
                  </Text>
                </Text>
                <Text style={[styles.cardText, { color: colors.textMuted }]}>
                  Router ID:{" "}
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {detailPolicy.router_id}
                  </Text>
                </Text>
                <Text style={[styles.cardText, { color: colors.textMuted }]}>
                  Requested:{" "}
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {formatDateTime(detailPolicy.requested_at)}
                  </Text>
                </Text>
                {detailPolicy.applied_at ? (
                  <Text style={[styles.cardText, { color: colors.textMuted }]}>
                    Applied:{" "}
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {formatDateTime(detailPolicy.applied_at)}
                    </Text>
                  </Text>
                ) : null}
              </View>
            ) : null}

            {policy.failure_reason ? (
              <Text style={[styles.failureText, { color: colors.dangerText }]}>
                {policy.failure_reason}
              </Text>
            ) : null}

            <Pressable
              disabled={isLoadingDetail}
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
                isLoadingDetail && styles.buttonDisabled,
              ]}
              onPress={() => onViewPolicyDetail(policy.id)}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  {
                    color: selected ? colors.buttonText : colors.text,
                  },
                ]}
              >
                {isLoadingDetail
                  ? "Loading..."
                  : selected
                    ? "Hide policy details"
                    : "View policy details"}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}


export function DevicesScreen() {
  const { colors } = usePulseFiTheme();
  const [data, setData] = useState<DevicesData | null>(null);
  const [selectedDeviceDetail, setSelectedDeviceDetail] =
    useState<DeviceDetail | null>(null);
  const [loadingDeviceDetailId, setLoadingDeviceDetailId] =
    useState<string | null>(null);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, LimitDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workingDeviceId, setWorkingDeviceId] = useState<string | null>(null);
  const [workingPolicyId, setWorkingPolicyId] = useState<string | null>(null);
  const [trustUpdatingDeviceId, setTrustUpdatingDeviceId] =
    useState<string | null>(null);
  const [loadingPolicyDetailId, setLoadingPolicyDetailId] =
    useState<string | null>(null);
  const [selectedPolicyDetail, setSelectedPolicyDetail] =
    useState<MyDevicePolicy | null>(null);
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

      const routerIds = Array.from(
        new Set(devices.map((device) => device.router_id))
      );

      const capabilityEntries = await Promise.all(
        routerIds.map(async (routerId) => {
          try {
            const capabilities = await getMyRouterCapabilities(routerId);
            return [routerId, capabilities] as const;
          } catch {
            return [routerId, null] as const;
          }
        })
      );

      const routerCapabilities =
        capabilityEntries.reduce<Record<string, MyRouterCapabilities | null>>(
          (current, [routerId, capabilities]) => ({
            ...current,
            [routerId]: capabilities,
          }),
          {}
        );

      setData({ devices, deviceUsage, policies, routerCapabilities });

      setLimitDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };

        for (const device of devices) {
          if (!nextDrafts[device.id]) {
            nextDrafts[device.id] = {
              downloadLimitMbps: "10",
              uploadLimitMbps: "2",
            };
          }
        }

        return nextDrafts;
      });
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

  function updateLimitDraft(
    deviceId: string,
    field: keyof LimitDraft,
    value: string
  ) {
    setLimitDrafts((currentDrafts) => ({
      ...currentDrafts,
      [deviceId]: {
        downloadLimitMbps: currentDrafts[deviceId]?.downloadLimitMbps ?? "10",
        uploadLimitMbps: currentDrafts[deviceId]?.uploadLimitMbps ?? "2",
        [field]: value,
      },
    }));
  }

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

  async function handleViewDeviceDetail(deviceId: string) {
    if (selectedDeviceDetail?.device.id === deviceId) {
      setSelectedDeviceDetail(null);
      return;
    }

    try {
      setLoadingDeviceDetailId(deviceId);
      setErrorMessage(null);

      const [device, usage] = await Promise.all([
        getMyDevice(deviceId),
        getMyDeviceUsage(deviceId).catch(() => null),
      ]);

      setSelectedDeviceDetail({ device, usage });

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          devices: current.devices.map((item) =>
            item.id === device.id ? device : item
          ),
          deviceUsage: usage
            ? [
                usage,
                ...current.deviceUsage.filter((item) => item.id !== usage.id),
              ]
            : current.deviceUsage,
        };
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load device details."
      );
    } finally {
      setLoadingDeviceDetailId(null);
    }
  }

  async function handleUpdateDeviceTrust(device: MyDevice) {
    try {
      setTrustUpdatingDeviceId(device.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      const updatedDevice = await updateMyDeviceTrust(
        device.id,
        !device.is_trusted
      );

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          devices: current.devices.map((item) =>
            item.id === updatedDevice.id ? updatedDevice : item
          ),
          deviceUsage: current.deviceUsage.map((item) =>
            item.id === updatedDevice.id
              ? { ...item, is_trusted: updatedDevice.is_trusted }
              : item
          ),
        };
      });

      setSelectedDeviceDetail((currentDetail) =>
        currentDetail?.device.id === updatedDevice.id
          ? { ...currentDetail, device: updatedDevice }
          : currentDetail
      );

      setSuccessMessage(
        updatedDevice.is_trusted
          ? "Device marked as trusted."
          : "Device marked as untrusted."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update device trust state."
      );
    } finally {
      setTrustUpdatingDeviceId(null);
    }
  }

  async function handleViewPolicyDetail(policyId: string) {
    if (selectedPolicyDetail?.id === policyId) {
      setSelectedPolicyDetail(null);
      return;
    }

    try {
      setLoadingPolicyDetailId(policyId);
      setErrorMessage(null);

      const detail = await getMyDevicePolicy(policyId);
      setSelectedPolicyDetail(detail);

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          policies: current.policies.map((policy) =>
            policy.id === detail.id ? detail : policy
          ),
        };
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load policy details."
      );
    } finally {
      setLoadingPolicyDetailId(null);
    }
  }

  async function handleCreateCustomLimit(deviceId: string) {
    const device = data?.devices.find((item) => item.id === deviceId);
    const capabilities = device
      ? data?.routerCapabilities[device.router_id]
      : null;

    if (!capabilities?.can_apply_bandwidth_limit) {
      setErrorMessage(getCapabilityHelpText(capabilities, "bandwidth"));
      setSuccessMessage(null);
      return;
    }

    const draft = limitDrafts[deviceId] ?? {
      downloadLimitMbps: "10",
      uploadLimitMbps: "2",
    };

    const downloadLimit = parsePositiveNumber(draft.downloadLimitMbps);
    const uploadLimit = parsePositiveNumber(draft.uploadLimitMbps);

    if (downloadLimit === null || uploadLimit === null) {
      setErrorMessage("Download and upload limits must be numbers greater than 0.");
      setSuccessMessage(null);
      return;
    }

    await createAndAddPolicy(
      deviceId,
      (targetDeviceId) =>
        createBandwidthLimitPolicy(targetDeviceId, downloadLimit, uploadLimit),
      `Bandwidth policy created: ${downloadLimit} Mbps download / ${uploadLimit} Mbps upload. Execute it to apply.`
    );
  }

  async function handleCreateHighPriority(deviceId: string) {
    const device = data?.devices.find((item) => item.id === deviceId);
    const capabilities = device
      ? data?.routerCapabilities[device.router_id]
      : null;

    if (!capabilities?.can_apply_device_priority) {
      setErrorMessage(getCapabilityHelpText(capabilities, "priority"));
      setSuccessMessage(null);
      return;
    }

    await createAndAddPolicy(
      deviceId,
      (targetDeviceId) => createDevicePriorityPolicy(targetDeviceId, 8),
      "Priority policy created. Execute it to apply."
    );
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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>Loading connected devices...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          tintColor={colors.primary}
          onRefresh={() => void loadDevices(true)}
        />
      }
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>Devices</Text>
      <Text style={[styles.title, { color: colors.text }]}>Connected devices</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        View devices, usage totals, and custom download/upload router policies.
      </Text>

      {errorMessage ? (
        <View style={[styles.errorCard, { backgroundColor: colors.dangerBackground, borderColor: colors.dangerBorder }]}>
          <Text style={[styles.errorTitle, { color: colors.dangerText }]}>Device action failed</Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View style={[styles.successCard, { backgroundColor: colors.successBackground, borderColor: colors.successBorder }]}>
          <Text style={[styles.successTitle, { color: colors.successText }]}>Action completed</Text>
          <Text style={[styles.successText, { color: colors.successText }]}>{successMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Overview</Text>
        <Text style={[styles.bigNumber, { color: colors.text }]}>{data?.devices.length ?? 0}</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>known devices on your account</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Device List</Text>

        {data?.devices.length ? (
          data.devices.map((device) => {
            const usage = usageByDeviceId.get(device.id)?.usage;
            const policies = policiesByDeviceId.get(device.id) ?? [];
            const pendingPolicies = policies.filter(
              (policy) => policy.status === "pending"
            );
            const isWorkingOnDevice = workingDeviceId === device.id;
            const draft = limitDrafts[device.id] ?? {
              downloadLimitMbps: "10",
              uploadLimitMbps: "2",
            };
            const routerCapabilities = data.routerCapabilities[device.router_id];
            const canApplyBandwidthLimit =
              routerCapabilities?.can_apply_bandwidth_limit === true;
            const canApplyDevicePriority =
              routerCapabilities?.can_apply_device_priority === true;
            const selectedDetail =
              selectedDeviceDetail?.device.id === device.id
                ? selectedDeviceDetail
                : null;
            const isLoadingDeviceDetail = loadingDeviceDetailId === device.id;

            return (
              <View key={device.id} style={[styles.deviceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.deviceHeader}>
                  <View style={styles.deviceTitleGroup}>
                    <Text style={[styles.deviceTitle, { color: colors.text }]}>
                      {getDeviceDisplayName(device)}
                    </Text>
                    <Text style={[styles.smallText, { color: colors.textSubtle }]}>{device.mac_address}</Text>
                  </View>

                  <Text
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: device.is_trusted
                          ? colors.successBackground
                          : colors.dangerBackground,
                        borderColor: device.is_trusted
                          ? colors.successBorder
                          : colors.dangerBorder,
                        color: device.is_trusted
                          ? colors.successText
                          : colors.dangerText,
                      },
                    ]}
                  >
                    {device.is_trusted ? "Trusted" : "Untrusted"}
                  </Text>
                </View>

                <View style={styles.detailGrid}>
                  <Text style={[styles.cardText, { color: colors.textMuted }]}>
                    Status: <Text style={[styles.boldText, { color: colors.textMuted }]}>{device.status}</Text>
                  </Text>
                  <Text style={[styles.cardText, { color: colors.textMuted }]}>
                    IP:{" "}
                    <Text style={[styles.boldText, { color: colors.textMuted }]}>
                      {device.ip_address ?? "Unknown"}
                    </Text>
                  </Text>
                  <Text style={[styles.cardText, { color: colors.textMuted }]}>
                    Type:{" "}
                    <Text style={[styles.boldText, { color: colors.textMuted }]}>
                      {device.device_type ?? "Unknown"}
                    </Text>
                  </Text>
                  <Text style={[styles.cardText, { color: colors.textMuted }]}>
                    Last seen:{" "}
                    <Text style={[styles.boldText, { color: colors.textMuted }]}>
                      {formatDateTime(device.last_seen)}
                    </Text>
                  </Text>
                  <Text style={[styles.cardText, { color: colors.textMuted }]}>
                    Router mode:{" "}
                    <Text style={[styles.boldText, { color: colors.textMuted }]}>
                      {getRouterModeLabel(routerCapabilities)}
                    </Text>
                  </Text>
                </View>

                <Pressable
                  disabled={trustUpdatingDeviceId === device.id}
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: device.is_trusted
                        ? colors.surfaceMuted
                        : colors.primary,
                      borderColor: device.is_trusted
                        ? colors.border
                        : colors.primary,
                    },
                    trustUpdatingDeviceId === device.id &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() => void handleUpdateDeviceTrust(device)}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      {
                        color: device.is_trusted
                          ? colors.text
                          : colors.buttonText,
                      },
                    ]}
                  >
                    {trustUpdatingDeviceId === device.id
                      ? "Updating..."
                      : device.is_trusted
                        ? "Mark untrusted"
                        : "Trust device"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={isLoadingDeviceDetail}
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                    isLoadingDeviceDetail && styles.buttonDisabled,
                  ]}
                  onPress={() => void handleViewDeviceDetail(device.id)}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                    {isLoadingDeviceDetail
                      ? "Loading details..."
                      : selectedDetail
                        ? "Hide details"
                        : "View details"}
                  </Text>
                </Pressable>

                {selectedDetail ? (
                  <View
                    style={[
                      styles.limitBox,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.policyTitle, { color: colors.text }]}>
                      Device details
                    </Text>

                    <View style={styles.detailGrid}>
                      <Text style={[styles.cardText, { color: colors.textMuted }]}>
                        Name:{" "}
                        <Text style={[styles.boldText, { color: colors.text }]}>
                          {getDeviceDisplayName(selectedDetail.device)}
                        </Text>
                      </Text>
                      <Text style={[styles.cardText, { color: colors.textMuted }]}>
                        MAC:{" "}
                        <Text style={[styles.boldText, { color: colors.text }]}>
                          {selectedDetail.device.mac_address}
                        </Text>
                      </Text>
                      <Text style={[styles.cardText, { color: colors.textMuted }]}>
                        First seen:{" "}
                        <Text style={[styles.boldText, { color: colors.text }]}>
                          {formatDateTime(selectedDetail.device.first_seen)}
                        </Text>
                      </Text>
                      <Text style={[styles.cardText, { color: colors.textMuted }]}>
                        Updated:{" "}
                        <Text style={[styles.boldText, { color: colors.text }]}>
                          {formatDateTime(selectedDetail.device.updated_at)}
                        </Text>
                      </Text>
                    </View>

                    <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
                      Detail usage totals
                    </Text>
                    <DeviceUsageSummary usage={selectedDetail.usage?.usage} />
                  </View>
                ) : null}

                <DeviceUsageSummary usage={usage} />

                <View style={[styles.limitBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.policyTitle, { color: colors.text }]}>Custom bandwidth limit</Text>
                  <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                    Set separate download and upload Mbps for this device.
                  </Text>
                  <Text
                    style={
                      canApplyBandwidthLimit
                        ? styles.smallText
                        : styles.failureText
                    }
                  >
                    {canApplyBandwidthLimit
                      ? "Router supports custom bandwidth limits."
                      : getCapabilityHelpText(routerCapabilities, "bandwidth")}
                  </Text>

                  <View style={styles.inputGrid}>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Download Mbps</Text>
                      <TextInput
                        value={draft.downloadLimitMbps}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        editable={canApplyBandwidthLimit}
                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                        placeholder="10"
                        onChangeText={(value) =>
                          updateLimitDraft(device.id, "downloadLimitMbps", value)
                        }
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Upload Mbps</Text>
                      <TextInput
                        value={draft.uploadLimitMbps}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        editable={canApplyBandwidthLimit}
                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                        placeholder="2"
                        onChangeText={(value) =>
                          updateLimitDraft(device.id, "uploadLimitMbps", value)
                        }
                      />
                    </View>
                  </View>

                  <Pressable
                    disabled={isWorkingOnDevice || !canApplyBandwidthLimit}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.primary },
                      (isWorkingOnDevice || !canApplyBandwidthLimit) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={() => void handleCreateCustomLimit(device.id)}
                  >
                    <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
                      {isWorkingOnDevice
                        ? "Working..."
                        : canApplyBandwidthLimit
                          ? "Create custom limit"
                          : "Limit not supported"}
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={[
                    styles.limitBox,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <Text
                      style={[
                        styles.policyTitle,
                        { color: colors.text, flex: 1 },
                      ]}
                    >
                      Device priority
                    </Text>

                    <Pressable
                      disabled={isWorkingOnDevice || !canApplyDevicePriority}
                      style={[
                        styles.secondaryButton,
                        {
                          alignSelf: "flex-start",
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          minHeight: 38,
                          backgroundColor: canApplyDevicePriority
                            ? colors.primary
                            : colors.surface,
                          borderColor: canApplyDevicePriority
                            ? colors.primary
                            : colors.border,
                        },
                        (isWorkingOnDevice || !canApplyDevicePriority) &&
                          styles.buttonDisabled,
                      ]}
                      onPress={() => void handleCreateHighPriority(device.id)}
                    >
                      <Text
                        style={[
                          styles.secondaryButtonText,
                          {
                            fontSize: 12,
                            color: canApplyDevicePriority
                              ? colors.buttonText
                              : colors.textSubtle,
                          },
                        ]}
                      >
                        {isWorkingOnDevice
                          ? "Working..."
                          : canApplyDevicePriority
                            ? "High priority"
                            : "Unavailable"}
                      </Text>
                    </Pressable>
                  </View>

                  <Text
                    style={[
                      canApplyDevicePriority
                        ? styles.smallText
                        : styles.failureText,
                      {
                        color: canApplyDevicePriority
                          ? colors.textSubtle
                          : colors.dangerText,
                      },
                    ]}
                  >
                    {canApplyDevicePriority
                      ? "Router supports device priority actions."
                      : getCapabilityHelpText(routerCapabilities, "priority")}
                  </Text>
                </View>

                {pendingPolicies.length ? (
                  <View style={[styles.pendingBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    <Text style={[styles.policyTitle, { color: colors.text }]}>Pending policy actions</Text>
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
                          <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
                            {isExecuting
                              ? "Executing..."
                              : `Execute ${formatLabel(policy.policy_type)}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                <DevicePolicies
                  policies={policies}
                  selectedPolicyDetail={selectedPolicyDetail}
                  loadingPolicyDetailId={loadingPolicyDetailId}
                  onViewPolicyDetail={handleViewPolicyDetail}
                />
              </View>
            );
          })
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
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
    borderWidth: 1,
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
  limitBox: {
    gap: 10,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#F6F8FB",
  },
  inputGrid: {
    flexDirection: "row",
    gap: 8,
  },
  inputGroup: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#617083",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D6E0EA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
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
