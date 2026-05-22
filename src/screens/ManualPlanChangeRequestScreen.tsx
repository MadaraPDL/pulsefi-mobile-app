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

import {
  createMyPlanChangeRequest,
  getMyAvailablePlans,
  getMyPlanChangeRequests,
  getMySubscriptions,
} from "../api/appUser";
import { PulseFiButton } from "../components/PulseFiButton";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type {
  DecimalLike,
  MyPlanChangeRequest,
  MySubscription,
  MySubscriptionPlanSummary,
} from "../types/appUser";

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

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getRequestType(
  subscription: MySubscription | null,
  plan: MySubscriptionPlanSummary | null
): "upgrade" | "downgrade" {
  if (!subscription || !plan) {
    return "upgrade";
  }

  const currentPrice = toNumber(subscription.plan.monthly_price);
  const targetPrice = toNumber(plan.monthly_price);
  const currentData = toNumber(subscription.plan.data_limit_gb);
  const targetData = toNumber(plan.data_limit_gb);
  const currentSpeed = toNumber(subscription.plan.speed_limit_mbps);
  const targetSpeed = toNumber(plan.speed_limit_mbps);

  if (
    targetPrice >= currentPrice ||
    targetData >= currentData ||
    targetSpeed >= currentSpeed
  ) {
    return "upgrade";
  }

  return "downgrade";
}

export function ManualPlanChangeRequestScreen() {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [plans, setPlans] = useState<MySubscriptionPlanSummary[]>([]);
  const [requests, setRequests] = useState<MyPlanChangeRequest[]>([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] =
    useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [reason, setReason] = useState("Requested manually from PulseFi mobile app.");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);
      setSuccessMessage(null);

      const [subscriptionsResult, plansResult, requestsResult] =
        await Promise.all([
          getMySubscriptions(),
          getMyAvailablePlans(),
          getMyPlanChangeRequests(20),
        ]);

      setSubscriptions(subscriptionsResult);
      setPlans(plansResult);
      setRequests(requestsResult);

      setSelectedSubscriptionId((current) => {
        if (current && subscriptionsResult.some((item) => item.id === current)) {
          return current;
        }

        return (
          subscriptionsResult.find((item) => item.status === "active")?.id ??
          subscriptionsResult[0]?.id ??
          null
        );
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load plan request data."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedSubscription = useMemo(
    () =>
      subscriptions.find(
        (subscription) => subscription.id === selectedSubscriptionId
      ) ?? null,
    [selectedSubscriptionId, subscriptions]
  );

  const availableTargetPlans = useMemo(() => {
    if (!selectedSubscription) {
      return plans;
    }

    return plans.filter((plan) => plan.id !== selectedSubscription.plan_id);
  }, [plans, selectedSubscription]);

  const selectedPlan = useMemo(
    () => availableTargetPlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [availableTargetPlans, selectedPlanId]
  );

  useEffect(() => {
    if (!availableTargetPlans.length) {
      setSelectedPlanId(null);
      return;
    }

    setSelectedPlanId((current) => {
      if (current && availableTargetPlans.some((plan) => plan.id === current)) {
        return current;
      }

      return availableTargetPlans[0].id;
    });
  }, [availableTargetPlans]);

  const requestType = getRequestType(selectedSubscription, selectedPlan);

  async function handleSubmit() {
    if (!selectedSubscription || !selectedPlan) {
      setErrorMessage("Select a subscription and a target plan first.");
      setSuccessMessage(null);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const createdRequest = await createMyPlanChangeRequest({
        user_subscription_id: selectedSubscription.id,
        requested_plan_id: selectedPlan.id,
        request_type: requestType,
        reason: reason.trim() || null,
      });

      setRequests((current) => [createdRequest, ...current]);
      setSuccessMessage("Plan-change request sent to your ISP admin.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create plan-change request."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.mutedText}>Loading plans...</Text>
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
          onRefresh={() => void loadData(true)}
        />
      }
    >
      <Text style={styles.eyebrow}>Plan Request</Text>
      <Text style={styles.title}>Request a plan change</Text>
      <Text style={styles.subtitle}>
        Choose one of your subscriptions and request an active plan from your ISP.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Request failed</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Request sent</Text>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Current Subscription</Text>

        {subscriptions.length ? (
          subscriptions.map((subscription) => {
            const selected = selectedSubscriptionId === subscription.id;

            return (
              <Pressable
                key={subscription.id}
                style={[
                  styles.optionRow,
                  selected && styles.selectedOption,
                ]}
                onPress={() => setSelectedSubscriptionId(subscription.id)}
              >
                <View style={styles.optionHeader}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.optionTitle}>
                      {subscription.subscription_label ??
                        subscription.plan.plan_name}
                    </Text>
                    <Text style={styles.smallText}>
                      {subscription.plan.plan_name} ?{" "}
                      {formatGb(subscription.plan.data_limit_gb)} ?{" "}
                      {formatMoney(subscription.plan.monthly_price)}
                    </Text>
                  </View>

                  <Text style={[styles.statusPill, selected && styles.activePill]}>
                    {selected ? "Selected" : formatLabel(subscription.status)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.mutedText}>
            No subscriptions found for this account.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Target Plan</Text>

        {availableTargetPlans.length ? (
          availableTargetPlans.map((plan) => {
            const selected = selectedPlanId === plan.id;

            return (
              <Pressable
                key={plan.id}
                style={[
                  styles.optionRow,
                  selected && styles.selectedOption,
                ]}
                onPress={() => setSelectedPlanId(plan.id)}
              >
                <View style={styles.optionHeader}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.optionTitle}>{plan.plan_name}</Text>
                    <Text style={styles.smallText}>
                      {formatGb(plan.data_limit_gb)} ? {formatMoney(plan.monthly_price)}
                      {" ? "}
                      {formatMbps(plan.speed_limit_mbps)}
                    </Text>
                  </View>

                  <Text style={[styles.statusPill, selected && styles.activePill]}>
                    {selected ? "Target" : "Choose"}
                  </Text>
                </View>

                {plan.description ? (
                  <Text style={styles.cardText}>{plan.description}</Text>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.mutedText}>
            No other active plans are available for this ISP yet.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Request Summary</Text>
        <Text style={styles.cardText}>
          Request type:{" "}
          <Text style={styles.boldText}>{formatLabel(requestType)}</Text>
        </Text>
        <Text style={styles.cardText}>
          From:{" "}
          <Text style={styles.boldText}>
            {selectedSubscription?.plan.plan_name ?? "No subscription selected"}
          </Text>
        </Text>
        <Text style={styles.cardText}>
          To:{" "}
          <Text style={styles.boldText}>
            {selectedPlan?.plan_name ?? "No target plan selected"}
          </Text>
        </Text>

        <Text style={styles.inputLabel}>Reason</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          placeholder="Explain why you want this plan change"
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          style={styles.input}
        />

        <PulseFiButton
          title={isSubmitting ? "Sending..." : "Send plan request"}
          disabled={isSubmitting || !selectedSubscription || !selectedPlan}
          loading={isSubmitting}
          fullWidth
          onPress={() => void handleSubmit()}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Recent Requests</Text>

        {requests.length ? (
          requests.slice(0, 5).map((request) => (
            <View key={request.id} style={styles.requestRow}>
              <View style={styles.optionHeader}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.optionTitle}>
                    {formatLabel(request.request_type)}
                  </Text>
                  <Text style={styles.smallText}>
                    Requested: {new Date(request.requested_at).toLocaleString()}
                  </Text>
                </View>

                <Text style={styles.statusPill}>{formatLabel(request.status)}</Text>
              </View>

              {request.reason ? (
                <Text style={styles.cardText}>{request.reason}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.mutedText}>No plan-change requests yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

export default ManualPlanChangeRequestScreen;

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
    card: {
      borderRadius: 22,
      padding: 18,
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
    successCard: {
      borderRadius: 18,
      padding: 16,
      gap: 6,
      backgroundColor: colors.successBackground,
      borderWidth: 1,
      borderColor: colors.successBorder,
    },
    successTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.successText,
    },
    successText: {
      fontSize: 14,
      color: colors.successText,
    },
    cardLabel: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
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
    optionRow: {
      borderRadius: 18,
      padding: 14,
      gap: 8,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectedOption: {
      borderColor: colors.primary,
    },
    optionHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },
    statusPill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
      overflow: "hidden",
      fontSize: 12,
      fontWeight: "900",
      color: colors.primary,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textTransform: "capitalize",
    },
    activePill: {
      color: colors.mode === "dark" ? colors.primary : "#0B5D7A",
      backgroundColor:
        colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE",
      borderColor: colors.primary,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.textMuted,
    },
    input: {
      minHeight: 96,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      textAlignVertical: "top",
      fontSize: 15,
    },
    requestRow: {
      borderRadius: 18,
      padding: 14,
      gap: 8,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
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
