import { useCallback, useMemo, useState } from "react";
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

import {
  getMyAlerts,
  getMyPredictions,
  getMyRecommendations,
  getMyRouters,
  getMySubscriptions,
  getMyUsageRecords,
  getMyUsageSummary,
} from "../api/appUser";
import { useSelectedRouter } from "../state/SelectedRouterContext";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type {
  DecimalLike,
  MyAlert,
  MyPrediction,
  MyRecommendation,
  MyRouter,
  MySubscription,
  MyUsageRecord,
  MyUsageSummary,
} from "../types/appUser";

type AssistantData = {
  alerts: MyAlert[];
  predictions: MyPrediction[];
  recommendations: MyRecommendation[];
  records: MyUsageRecord[];
  routers: MyRouter[];
  subscriptions: MySubscription[];
  usageSummary: MyUsageSummary | null;
};

type AssistantQuestion =
  | "first_check"
  | "plan_limit"
  | "device_totals"
  | "alerts"
  | "next_action";

const assistantQuestions: { key: AssistantQuestion; label: string }[] = [
  { key: "first_check", label: "What should I check first?" },
  { key: "plan_limit", label: "Am I near my plan limit?" },
  { key: "device_totals", label: "Why do device totals not match?" },
  { key: "alerts", label: "What do my alerts mean?" },
  { key: "next_action", label: "What can I do now?" },
];

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

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(value)}%`;
}

function getRouterDisplayName(router: MyRouter | null) {
  return router?.router_name ?? router?.router_model ?? "No router selected";
}

function getLatestByDate<T>(items: T[], getDate: (item: T) => string | null | undefined) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(getDate(left) ?? 0).getTime();
    const rightTime = new Date(getDate(right) ?? 0).getTime();

    return rightTime - leftTime;
  })[0] ?? null;
}

function getSeverityRank(severity: string) {
  const normalized = severity.toLowerCase();

  if (normalized === "critical") {
    return 4;
  }

  if (normalized === "high") {
    return 3;
  }

  if (normalized === "medium") {
    return 2;
  }

  if (normalized === "low") {
    return 1;
  }

  return 0;
}

function buildAssistantAnswer({
  question,
  data,
  selectedRouter,
  selectedSubscription,
  planUsagePercent,
}: {
  question: AssistantQuestion;
  data: AssistantData;
  selectedRouter: MyRouter | null;
  selectedSubscription: MySubscription | null;
  planUsagePercent: number | null;
}) {
  const unreadAlerts = data.alerts.filter((alert) => !alert.read_at);
  const mostImportantAlert =
    [...unreadAlerts].sort(
      (left, right) =>
        getSeverityRank(right.severity) - getSeverityRank(left.severity)
    )[0] ?? null;
  const latestPrediction = getLatestByDate(
    data.predictions,
    (prediction) => prediction.created_at ?? prediction.prediction_date
  );
  const latestRecommendation = getLatestByDate(
    data.recommendations,
    (recommendation) => recommendation.created_at
  );
  const officialRecords = data.records.filter((record) => !record.device_id);
  const estimatedRecords = data.records.filter((record) => record.device_id);
  const totalMb = toNumber(data.usageSummary?.totals.total_mb);

  if (question === "first_check") {
    if (mostImportantAlert) {
      return {
        title: "Start with the most important alert.",
        body: `${mostImportantAlert.title}: ${mostImportantAlert.message}`,
        bullets: [
          `Unread alerts: ${unreadAlerts.length}`,
          `Selected router: ${getRouterDisplayName(selectedRouter)}`,
          selectedSubscription
            ? `Current package: ${selectedSubscription.plan.plan_name}`
            : "No package is linked to the selected router.",
        ],
      };
    }

    if (planUsagePercent !== null && planUsagePercent >= 80) {
      return {
        title: "Start with your package usage.",
        body: `You are at ${formatPercent(planUsagePercent)} of the selected package limit.`,
        bullets: [
          "Open Usage to review the daily trend.",
          "Check Predictions & recommendations for plan advice.",
          "Review device usage to see which device contributes most.",
        ],
      };
    }

    return {
      title: "Your account looks stable right now.",
      body: "Start from Usage to confirm the selected router total, then check Insights for predictions and recommendations.",
      bullets: [
        `Selected router: ${getRouterDisplayName(selectedRouter)}`,
        `Loaded usage total: ${formatMb(totalMb)}`,
        `Unread alerts: ${unreadAlerts.length}`,
      ],
    };
  }

  if (question === "plan_limit") {
    if (!selectedSubscription) {
      return {
        title: "No selected package was found.",
        body: "Choose a router from More → My routers so PulseFi can match the router to its service line and package.",
        bullets: [
          "The assistant needs the selected router/service line context.",
          "After selecting a router, reopen this assistant.",
        ],
      };
    }

    return {
      title:
        planUsagePercent !== null && planUsagePercent >= 80
          ? "You may be close to the package limit."
          : "You are not showing a high plan-limit risk from loaded usage.",
      body: `PulseFi shows ${formatMb(totalMb)} used from the ${selectedSubscription.plan.data_limit_gb} GB package.`,
      bullets: [
        `Package: ${selectedSubscription.plan.plan_name}`,
        `Usage ratio: ${formatPercent(planUsagePercent)}`,
        latestPrediction
          ? `Latest prediction risk: ${latestPrediction.risk_level}`
          : "No prediction is loaded yet.",
      ],
    };
  }

  if (question === "device_totals") {
    return {
      title: "Official and device totals can be different.",
      body: "Official usage is the service-line total used against the package limit. Estimated usage is the router/CPE per-device breakdown and may not perfectly equal the official total.",
      bullets: [
        `Official records loaded: ${officialRecords.length}`,
        `Estimated device records loaded: ${estimatedRecords.length}`,
        "Use Official for plan-limit explanation.",
        "Use Estimated when explaining which device used data.",
      ],
    };
  }

  if (question === "alerts") {
    if (!data.alerts.length) {
      return {
        title: "No alerts are loaded right now.",
        body: "That means PulseFi has no recent alert records to show for this user in the current mobile view.",
        bullets: [
          "Run a simulator scenario from ISP Admin if you need demo alerts.",
          "Pull to refresh after a simulator run.",
        ],
      };
    }

    return {
      title: mostImportantAlert
        ? "Focus on unread/high-severity alerts first."
        : "All loaded alerts appear read or lower priority.",
      body: mostImportantAlert
        ? `${mostImportantAlert.title}: ${mostImportantAlert.message}`
        : "Open Alerts to review the full alert list and history.",
      bullets: [
        `Loaded alerts: ${data.alerts.length}`,
        `Unread alerts: ${unreadAlerts.length}`,
        mostImportantAlert
          ? `Top severity: ${mostImportantAlert.severity}`
          : "No unread alert needs immediate attention.",
      ],
    };
  }

  return {
    title: "Recommended next action",
    body: latestRecommendation
      ? latestRecommendation.recommendation_text
      : "Review Usage first, then open Predictions & recommendations after the ISP Admin runs intelligence.",
    bullets: [
      latestRecommendation?.reason
        ? `Reason: ${latestRecommendation.reason}`
        : "No recommendation reason is loaded yet.",
      latestPrediction
        ? `Prediction risk: ${latestPrediction.risk_level}`
        : "No prediction is loaded yet.",
      "For plan changes, use More → Request a plan change.",
    ],
  };
}

export function AssistantScreen() {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { selectedRouterId, setSelectedRouterId } = useSelectedRouter();
  const [data, setData] = useState<AssistantData | null>(null);
  const [selectedQuestion, setSelectedQuestion] =
    useState<AssistantQuestion>("first_check");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAssistant = useCallback(async (refreshing = false) => {
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

      const [usageSummary, records, alerts, predictions, recommendations] =
        await Promise.all([
          effectiveRouterId ? getMyUsageSummary(effectiveRouterId) : null,
          getMyUsageRecords(50, effectiveRouterId),
          getMyAlerts(20, effectiveRouterId),
          getMyPredictions(10),
          getMyRecommendations(10),
        ]);

      setData({
        alerts,
        predictions,
        recommendations,
        records,
        routers,
        subscriptions,
        usageSummary,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load PulseFi Assistant data."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRouterId, setSelectedRouterId]);

  useFocusEffect(
    useCallback(() => {
      void loadAssistant();
    }, [loadAssistant])
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

  const planUsagePercent = useMemo(() => {
    if (!selectedSubscription?.plan.data_limit_gb || !data?.usageSummary) {
      return null;
    }

    const limitMb = toNumber(selectedSubscription.plan.data_limit_gb) * 1024;

    if (limitMb <= 0) {
      return null;
    }

    return Math.min((toNumber(data.usageSummary.totals.total_mb) / limitMb) * 100, 100);
  }, [data?.usageSummary, selectedSubscription]);

  const answer = data
    ? buildAssistantAnswer({
        question: selectedQuestion,
        data,
        selectedRouter,
        selectedSubscription,
        planUsagePercent,
      })
    : null;

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.mutedText}>Loading PulseFi Assistant...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          tintColor={colors.primary}
          onRefresh={() => void loadAssistant(true)}
        />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>PulseFi Assistant</Text>
        <Text style={styles.title}>Ask about your usage</Text>
        <Text style={styles.subtitle}>
          A rules-based MVP helper using your loaded PulseFi data. No external AI
          call is made in this version.
        </Text>
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not refresh assistant</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void loadAssistant(true)}
          >
            <Text style={styles.retryButtonText}>Retry refresh</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.contextCard}>
        <Text style={styles.cardLabel}>Current context</Text>
        <Text style={styles.contextTitle}>{getRouterDisplayName(selectedRouter)}</Text>
        <Text style={styles.contextText}>
          Package: {selectedSubscription?.plan.plan_name ?? "No package selected"}
        </Text>
        <Text style={styles.contextText}>
          Loaded usage: {formatMb(data?.usageSummary?.totals.total_mb ?? 0)} ·
          Package usage: {formatPercent(planUsagePercent)}
        </Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.cardLabel}>Quick questions</Text>
        <View style={styles.questionList}>
          {assistantQuestions.map((question) => {
            const active = question.key === selectedQuestion;

            return (
              <Pressable
                key={question.key}
                style={[
                  styles.questionButton,
                  active ? styles.questionButtonActive : null,
                ]}
                onPress={() => setSelectedQuestion(question.key)}
              >
                <Text
                  style={[
                    styles.questionButtonText,
                    active ? styles.questionButtonTextActive : null,
                  ]}
                >
                  {question.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {answer ? (
        <View style={styles.answerCard}>
          <Text style={styles.cardLabel}>Assistant answer</Text>
          <Text style={styles.answerTitle}>{answer.title}</Text>
          <Text style={styles.answerBody}>{answer.body}</Text>

          <View style={styles.bulletList}>
            {answer.bullets.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

export default AssistantScreen;

function createStyles(colors: ReturnType<typeof usePulseFiTheme>["colors"]) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      gap: 16,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 24,
      backgroundColor: colors.background,
    },
    mutedText: {
      fontSize: 14,
      color: colors.textSubtle,
      textAlign: "center",
    },
    heroCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      gap: 8,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    title: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    contextCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 16,
      gap: 8,
    },
    questionCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 16,
      gap: 12,
    },
    answerCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 18,
      gap: 12,
    },
    cardLabel: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    contextTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },
    contextText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
    },
    questionList: {
      gap: 10,
    },
    questionButton: {
      minHeight: 46,
      justifyContent: "center",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    questionButtonActive: {
      borderColor: colors.primary,
      backgroundColor:
        colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE",
    },
    questionButtonText: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.textMuted,
    },
    questionButtonTextActive: {
      color: colors.primary,
    },
    answerTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: colors.text,
    },
    answerBody: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
    },
    bulletList: {
      gap: 9,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
    },
    bulletDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.primary,
      marginTop: 7,
    },
    bulletText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
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
    retryButton: {
      alignSelf: "flex-start",
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
      marginTop: 6,
      backgroundColor: colors.primary,
    },
    retryButtonText: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.buttonText,
    },
  });
}
