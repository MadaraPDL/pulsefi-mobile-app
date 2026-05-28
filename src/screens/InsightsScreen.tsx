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

import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  createMyPlanChangeRequest,
  createPlanChangeRequestFromRecommendation,
  getMyAvailablePlans,
  getMyPlanChangeRequests,
  getMyPredictions,
  getMyRecommendations,
  getMyRouters,
  getMySubscriptions,
} from "../api/appUser";
import type {
  AppTabParamList,
  PulseFiAssistantTargetType,
} from "../navigation/types";
import { useSelectedRouter } from "../state/SelectedRouterContext";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type {
  DecimalLike,
  MyPlanChangeRequest,
  MyPrediction,
  MyRecommendation,
  MyRouter,
  MySubscription,
  MySubscriptionPlanSummary,
} from "../types/appUser";

type InsightsData = {
  predictions: MyPrediction[];
  recommendations: MyRecommendation[];
  planChangeRequests: MyPlanChangeRequest[];
  routers: MyRouter[];
  subscriptions: MySubscription[];
  plans: MySubscriptionPlanSummary[];
};

type InsightsTab = "predictions" | "recommendations";
type RecommendationStatusFilter = "all" | "pending" | "accepted" | "rejected";

type InsightsScreenProps = {
  onOpenAssistant?: (
    question: string,
    target?: AssistantLaunchTarget
  ) => void;
  onOpenServiceRequests?: () => void;
};

type AssistantLaunchTarget = {
  targetType: PulseFiAssistantTargetType;
  targetId: string;
};

const INSIGHT_PAGE_SIZE = 5;
const QUICK_PAGE_COUNT = 3;
const USER_VISIBLE_INSIGHT_DAYS = 90;

function toNumber(value: DecimalLike | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatGb(value: DecimalLike) {
  return `${toNumber(value).toFixed(2)} GB`;
}

function formatPercent(value: DecimalLike | null) {
  if (value === null) {
    return "Unknown";
  }

  const number = toNumber(value);
  return number <= 1 ? `${Math.round(number * 100)}%` : `${Math.round(number)}%`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function isWithinUserVisibleWindow(value: string | null | undefined) {
  if (!value) {
    return true;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return true;
  }

  const cutoff = Date.now() - USER_VISIBLE_INSIGHT_DAYS * 24 * 60 * 60 * 1000;
  return timestamp >= cutoff;
}

function getRiskStyle(
  riskLevel: string,
  colors: ReturnType<typeof usePulseFiTheme>["colors"]
) {
  const normalized = riskLevel.toLowerCase();

  if (normalized === "high" || normalized === "critical") {
    return {
      color: colors.dangerText,
      backgroundColor: colors.dangerBackground,
      borderColor: colors.dangerBorder,
    };
  }

  if (normalized === "medium" || normalized === "warning") {
    return {
      color: "#FFD66B",
      backgroundColor: "#302511",
      borderColor: "#6F5012",
    };
  }

  return {
    color: colors.successText,
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
  };
}

function getRouterDisplayName(router: MyRouter | null) {
  return router?.router_name ?? router?.router_model ?? "No router selected";
}

function getPageCount(totalItems: number) {
  return Math.max(1, Math.ceil(totalItems / INSIGHT_PAGE_SIZE));
}

type RecommendationActionDirection = "upgrade" | "downgrade" | null;

function getRecommendationSearchText(recommendation: MyRecommendation) {
  return [
    recommendation.recommendation_type,
    recommendation.recommendation_text,
    recommendation.reason ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function normalizePlanText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isStayOrNoChangeRecommendation(recommendation: MyRecommendation) {
  const searchableText = normalizePlanText(getRecommendationSearchText(recommendation));

  const staySignals = [
    "stay on current plan",
    "stay on your current plan",
    "stay with current plan",
    "stay with your current plan",
    "keep current plan",
    "keep your current plan",
    "remain on current plan",
    "remain on your current plan",
    "continue with current plan",
    "current plan is enough",
    "current package is enough",
    "no plan change",
    "no change needed",
    "no upgrade needed",
    "no downgrade needed",
  ];

  return staySignals.some((signal) => searchableText.includes(signal));
}

function hasManualPlanChangeSignal(recommendation: MyRecommendation) {
  if (isStayOrNoChangeRecommendation(recommendation)) {
    return false;
  }

  const searchableText = normalizePlanText(getRecommendationSearchText(recommendation));

  const changeSignals = [
    "upgrade",
    "downgrade",
    "switch to",
    "move to",
    "change to",
    "change plan",
    "change package",
    "recommended plan",
    "recommended package",
    "recommended bundle",
    "better plan",
    "better package",
    "more suitable plan",
    "more suitable package",
  ];

  return changeSignals.some((signal) => searchableText.includes(signal));
}

function getPlanChangeDirection(
  recommendation: MyRecommendation
): RecommendationActionDirection {
  if (isStayOrNoChangeRecommendation(recommendation)) {
    return null;
  }

  const type = recommendation.recommendation_type.toLowerCase();
  const searchableText = getRecommendationSearchText(recommendation);

  if (type === "downgrade" || searchableText.includes("downgrade")) {
    return "downgrade";
  }

  const downgradeSignals = [
    "lower plan",
    "lower package",
    "cheaper",
    "save money",
    "reduce cost",
    "reduce your cost",
  ];

  if (downgradeSignals.some((signal) => searchableText.includes(signal))) {
    return "downgrade";
  }

  if (
    type === "upgrade" ||
    searchableText.includes("upgrade") ||
    recommendation.recommendation_plan_id !== null ||
    hasManualPlanChangeSignal(recommendation)
  ) {
    return "upgrade";
  }

  return null;
}

function getSignificantPlanTokens(planName: string) {
  const ignored = new Set([
    "plan",
    "package",
    "bundle",
    "internet",
    "wifi",
    "the",
    "and",
    "for",
  ]);

  return normalizePlanText(planName)
    .split(" ")
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

function getPlanMatchScore(
  recommendationText: string,
  plan: MySubscriptionPlanSummary
) {
  const planName = normalizePlanText(plan.plan_name);
  const tokens = getSignificantPlanTokens(plan.plan_name);
  const recommendationWords = recommendationText.split(" ");

  if (!planName && tokens.length === 0) {
    return 0;
  }

  let score = 0;

  const directPhrases = planName
    ? [
        `upgrade to ${planName}`,
        `downgrade to ${planName}`,
        `switch to ${planName}`,
        `move to ${planName}`,
        `change to ${planName}`,
        `recommended plan ${planName}`,
        `recommended package ${planName}`,
        `recommended bundle ${planName}`,
      ]
    : [];

  if (directPhrases.some((phrase) => recommendationText.includes(phrase))) {
    score += 200;
  }

  if (planName && recommendationText.includes(planName)) {
    score += 120;
  }

  for (const token of tokens) {
    if (recommendationWords.includes(token)) {
      score += 40;
    }
  }

  return score;
}

function findRecommendedPlanFromText(
  recommendation: MyRecommendation,
  plans: MySubscriptionPlanSummary[],
  selectedSubscription: MySubscription | null
) {
  if (isStayOrNoChangeRecommendation(recommendation)) {
    return null;
  }

  const searchableText = normalizePlanText(getRecommendationSearchText(recommendation));

  const candidates = plans
    .filter((plan) => selectedSubscription?.plan_id !== plan.id)
    .map((plan) => ({
      plan,
      score: getPlanMatchScore(searchableText, plan),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.plan ?? null;
}

function getRequestTypeFromPlanComparison(
  selectedSubscription: MySubscription,
  targetPlan: MySubscriptionPlanSummary
): "upgrade" | "downgrade" {
  const currentPrice = toNumber(selectedSubscription.plan.monthly_price);
  const targetPrice = toNumber(targetPlan.monthly_price);
  const currentData = toNumber(selectedSubscription.plan.data_limit_gb);
  const targetData = toNumber(targetPlan.data_limit_gb);
  const currentSpeed = toNumber(selectedSubscription.plan.speed_limit_mbps);
  const targetSpeed = toNumber(targetPlan.speed_limit_mbps);

  if (
    targetPrice >= currentPrice ||
    targetData >= currentData ||
    targetSpeed >= currentSpeed
  ) {
    return "upgrade";
  }

  return "downgrade";
}

function isPlanChangeRecommendation(
  recommendation: MyRecommendation,
  matchedPlan: MySubscriptionPlanSummary | null = null
) {
  if (isStayOrNoChangeRecommendation(recommendation)) {
    return false;
  }

  return (
    recommendation.recommendation_plan_id !== null ||
    matchedPlan !== null ||
    hasManualPlanChangeSignal(recommendation)
  );
}

function getRecommendationActionLabel(
  recommendation: MyRecommendation,
  matchedPlan: MySubscriptionPlanSummary | null = null,
  selectedSubscription: MySubscription | null = null
) {
  if (matchedPlan && selectedSubscription) {
    const direction = getRequestTypeFromPlanComparison(selectedSubscription, matchedPlan);
    return direction === "downgrade"
      ? "Request this downgrade"
      : "Request this upgrade";
  }

  const direction = getPlanChangeDirection(recommendation);

  if (direction === "downgrade") {
    return "Request this downgrade";
  }

  return "Request this upgrade";
}

function canRequestPlanChange(
  recommendation: MyRecommendation,
  matchedPlan: MySubscriptionPlanSummary | null = null
) {
  const status = recommendation.status.toLowerCase();

  return (
    status !== "accepted" &&
    status !== "rejected" &&
    (recommendation.recommendation_plan_id !== null || matchedPlan !== null)
  );
}

export function InsightsScreen({
  onOpenAssistant,
  onOpenServiceRequests,
}: InsightsScreenProps = {}) {
  const { colors } = usePulseFiTheme();
  const navigation =
    useNavigation<BottomTabNavigationProp<AppTabParamList, "More">>();
  const { selectedRouterId, setSelectedRouterId } = useSelectedRouter();
  const primaryActionBackground =
    colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE";
  const primaryActionText = colors.mode === "dark" ? colors.primary : "#0B5D7A";

  const [data, setData] = useState<InsightsData | null>(null);
  const [activeTab, setActiveTab] = useState<InsightsTab>("predictions");
  const [predictionPage, setPredictionPage] = useState(1);
  const [recommendationPage, setRecommendationPage] = useState(1);
  const [recommendationStatusFilter, setRecommendationStatusFilter] =
    useState<RecommendationStatusFilter>("all");
  const [creatingRequestId, setCreatingRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadInsights = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);
      setSuccessMessage(null);

      const [
        predictions,
        recommendations,
        planChangeRequests,
        routers,
        subscriptions,
        plans,
      ] = await Promise.all([
        getMyPredictions(100),
        getMyRecommendations(100),
        getMyPlanChangeRequests(50),
        getMyRouters(),
        getMySubscriptions(),
        getMyAvailablePlans(),
      ]);

      setData({
        predictions,
        recommendations,
        planChangeRequests,
        routers,
        subscriptions,
        plans,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load insights."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

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
    if (!selectedRouterId && selectedRouter) {
      setSelectedRouterId(selectedRouter.id);
    }
  }, [selectedRouter, selectedRouterId, setSelectedRouterId]);

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

  const selectedServiceLineId = selectedRouter?.user_subscription_id ?? null;

  const selectedPredictions = useMemo(() => {
    if (!selectedServiceLineId) {
      return [];
    }

    return (data?.predictions ?? []).filter(
      (prediction) =>
        prediction.user_subscription_id === selectedServiceLineId &&
        isWithinUserVisibleWindow(prediction.created_at ?? prediction.prediction_date)
    );
  }, [data?.predictions, selectedServiceLineId]);

  const selectedRecommendations = useMemo(() => {
    if (!selectedServiceLineId) {
      return [];
    }

    return (data?.recommendations ?? []).filter(
      (recommendation) =>
        recommendation.user_subscription_id === selectedServiceLineId &&
        isWithinUserVisibleWindow(recommendation.created_at)
    );
  }, [data?.recommendations, selectedServiceLineId]);

  const filteredRecommendations = useMemo(() => {
    return selectedRecommendations.filter((recommendation) => {
      if (recommendationStatusFilter === "all") {
        return true;
      }

      return recommendation.status.toLowerCase() === recommendationStatusFilter;
    });
  }, [selectedRecommendations, recommendationStatusFilter]);

  const selectedPlanChangeRequests = useMemo(() => {
    if (!selectedServiceLineId) {
      return [];
    }

    return (data?.planChangeRequests ?? []).filter(
      (request) => request.user_subscription_id === selectedServiceLineId
    );
  }, [data?.planChangeRequests, selectedServiceLineId]);

  const predictionPageCount = getPageCount(selectedPredictions.length);
  const safePredictionPage = Math.min(predictionPage, predictionPageCount);
  const paginatedPredictions = selectedPredictions.slice(
    (safePredictionPage - 1) * INSIGHT_PAGE_SIZE,
    safePredictionPage * INSIGHT_PAGE_SIZE
  );

  const recommendationPageCount = getPageCount(filteredRecommendations.length);
  const safeRecommendationPage = Math.min(
    recommendationPage,
    recommendationPageCount
  );
  const paginatedRecommendations = filteredRecommendations.slice(
    (safeRecommendationPage - 1) * INSIGHT_PAGE_SIZE,
    safeRecommendationPage * INSIGHT_PAGE_SIZE
  );

  useEffect(() => {
    setPredictionPage(1);
    setRecommendationPage(1);
  }, [selectedServiceLineId]);

  useEffect(() => {
    setRecommendationPage(1);
  }, [recommendationStatusFilter]);

  const openAssistantQuestion = useCallback(
    (question: string, target?: AssistantLaunchTarget) => {
      if (onOpenAssistant) {
        onOpenAssistant(question, target);
        return;
      }

      navigation.navigate("More", {
        section: "assistant",
        assistantQuestion: question,
        assistantQuestionKey: Date.now(),
        assistantTargetType: target?.targetType,
        assistantTargetId: target?.targetId,
      });
    },
    [navigation, onOpenAssistant]
  );

  async function handleRequestPlanChange(
    recommendation: MyRecommendation,
    matchedPlan: MySubscriptionPlanSummary | null
  ) {
    try {
      setCreatingRequestId(recommendation.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      let createdRequest: MyPlanChangeRequest;

      if (recommendation.recommendation_plan_id !== null) {
        createdRequest = await createPlanChangeRequestFromRecommendation(
          recommendation.id
        );
      } else if (matchedPlan && selectedSubscription) {
        const requestType = getRequestTypeFromPlanComparison(
          selectedSubscription,
          matchedPlan
        );

        createdRequest = await createMyPlanChangeRequest({
          user_subscription_id: selectedSubscription.id,
          requested_plan_id: matchedPlan.id,
          request_type: requestType,
          reason: `Requested from PulseFi recommendation: ${recommendation.recommendation_text}`,
          confirmation_text: "CHANGE PLAN",
        });
      } else {
        setErrorMessage(
          "This recommendation does not include a direct target plan. Open Service requests to choose a plan manually."
        );
        return;
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          planChangeRequests: [createdRequest, ...current.planChangeRequests],
          recommendations: current.recommendations.map((item) =>
            item.id === recommendation.id ? { ...item, status: "accepted" } : item
          ),
        };
      });

      setSuccessMessage(
        "Recommendation request sent to your ISP Admin for the selected router."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create plan change request."
      );
    } finally {
      setCreatingRequestId(null);
    }
  }

  if (isLoading && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
          Loading insights...
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
          onRefresh={() => void loadInsights(true)}
        />
      }
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>Insights</Text>
      <Text style={[styles.title, { color: colors.text }]}>
        Predictions & recommendations
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Switch between predictions and recommendations, then use page controls
        like records/logs.
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
            Action failed
          </Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>
            {errorMessage}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => void loadInsights(true)}
          >
            <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
              Refresh
            </Text>
          </Pressable>
        </View>
      ) : null}

      {successMessage ? (
        <View
          style={[
            styles.successCard,
            {
              backgroundColor: colors.successBackground,
              borderColor: colors.successBorder,
            },
          ]}
        >
          <Text style={[styles.successTitle, { color: colors.successText }]}>
            Request sent
          </Text>
          <Text style={[styles.successText, { color: colors.successText }]}>
            {successMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.segmentRow}>
        {(["predictions", "recommendations"] as InsightsTab[]).map((option) => {
          const active = activeTab === option;

          return (
            <Pressable
              key={option}
              style={[
                styles.segmentButton,
                {
                  backgroundColor: active ? primaryActionBackground : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveTab(option)}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  { color: active ? primaryActionText : colors.textMuted },
                ]}
              >
                {option === "predictions" ? "Predictions" : "Recommendations"}
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
          Selected Router
        </Text>
        <Text style={[styles.itemTitle, { color: colors.text }]}>
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

      {activeTab === "predictions" ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            Predictions
          </Text>
          <Text style={[styles.smallText, { color: colors.textSubtle }]}>
            {selectedPredictions.length} recent prediction(s). Older predictions
            stay in admin/database but are hidden from the user app.
          </Text>

          {selectedPredictions.length ? (
            <>
              {paginatedPredictions.map((prediction) => (
                <View
                  key={prediction.id}
                  style={[
                    styles.itemRow,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.itemHeader}>
                    <View style={styles.itemTitleGroup}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {formatGb(prediction.predicted_usage_gb)}
                      </Text>
                      <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                        {formatDate(prediction.period_start)} â†’{" "}
                        {formatDate(prediction.period_end)}
                      </Text>
                    </View>

                    <Text style={[styles.pill, getRiskStyle(prediction.risk_level, colors)]}>
                      {formatLabel(prediction.risk_level)}
                    </Text>
                  </View>

                  <Text style={[styles.cardText, { color: colors.textMuted }]}>
                    Confidence: {formatPercent(prediction.confidence_score)}
                  </Text>
                  <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                    Model: {prediction.model_version ?? "Not specified"}
                  </Text>

                  <Pressable
                    style={[
                      styles.assistantButton,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() =>
                      openAssistantQuestion("What does this prediction mean?", {
                        targetType: "prediction",
                        targetId: prediction.id,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.assistantButtonText,
                        { color: colors.textMuted },
                      ]}
                    >
                      What does this prediction mean?
                    </Text>
                  </Pressable>
                </View>
              ))}

              <PageControls
                page={safePredictionPage}
                pageCount={predictionPageCount}
                onPageChange={setPredictionPage}
                colors={colors}
                primaryActionBackground={primaryActionBackground}
                primaryActionText={primaryActionText}
              />
            </>
          ) : (
            <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
              No recent predictions found for this selected router.
            </Text>
          )}
        </View>
      ) : null}

      {activeTab === "recommendations" ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            Recommendations
          </Text>
          <Text style={[styles.smallText, { color: colors.textSubtle }]}>
            {filteredRecommendations.length} recommendation(s) match the current
            filter.
          </Text>

          <View style={styles.filterRow}>
            {(
              [
                { key: "all", label: `All (${selectedRecommendations.length})` },
                { key: "pending", label: "Pending" },
                { key: "accepted", label: "Accepted" },
                { key: "rejected", label: "Rejected" },
              ] as Array<{ key: RecommendationStatusFilter; label: string }>
            ).map((option) => {
              const active = recommendationStatusFilter === option.key;

              return (
                <Pressable
                  key={option.key}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: active
                        ? primaryActionBackground
                        : colors.surfaceMuted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setRecommendationStatusFilter(option.key)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: active ? primaryActionText : colors.textMuted },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {filteredRecommendations.length ? (
            <>
              {paginatedRecommendations.map((recommendation) => {
                const matchedPlan = findRecommendedPlanFromText(
                  recommendation,
                  data?.plans ?? [],
                  selectedSubscription
                );
                const recommendationDirection =
                  getPlanChangeDirection(recommendation);
                const planQuestion =
                  recommendationDirection === "downgrade"
                    ? "Should I downgrade?"
                    : "Should I upgrade?";
                const existingPendingRequest = selectedPlanChangeRequests.find(
                  (request) => {
                    const requestStatus = request.status.toLowerCase();
                    const requestType = request.request_type.toLowerCase();

                    if (requestStatus !== "pending") {
                      return false;
                    }

                    if (request.recommendation_id === recommendation.id) {
                      return true;
                    }

                    if (matchedPlan && request.requested_plan_id === matchedPlan.id) {
                      return true;
                    }

                    return (
                      recommendationDirection !== null &&
                      (requestType === "upgrade" || requestType === "downgrade")
                    );
                  }
                );
                const isCreating = creatingRequestId === recommendation.id;
                const canRequest =
                  canRequestPlanChange(recommendation, matchedPlan) &&
                  !existingPendingRequest;

                return (
                  <View
                    key={recommendation.id}
                    style={[
                      styles.itemRow,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.itemHeader}>
                      <View style={styles.itemTitleGroup}>
                        <Text style={[styles.itemTitle, { color: colors.text }]}>
                          {formatLabel(recommendation.recommendation_type)}
                        </Text>
                        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                          {formatDate(recommendation.created_at)}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            color: colors.primary,
                          },
                        ]}
                      >
                        {formatLabel(recommendation.status)}
                      </Text>
                    </View>

                    <Text style={[styles.cardText, { color: colors.textMuted }]}>
                      {recommendation.recommendation_text}
                    </Text>

                    {recommendation.reason ? (
                      <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                        Reason: {recommendation.reason}
                      </Text>
                    ) : null}

                    <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                      Confidence: {formatPercent(recommendation.confidence_score)}
                    </Text>

                    <View style={styles.assistantButtonRow}>
                      <Pressable
                        style={[
                          styles.assistantButton,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() =>
                          openAssistantQuestion(
                            "Why am I getting this recommendation?",
                            {
                              targetType: "recommendation",
                              targetId: recommendation.id,
                            }
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.assistantButtonText,
                            { color: colors.textMuted },
                          ]}
                        >
                          Why am I getting this recommendation?
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.assistantButton,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() =>
                          openAssistantQuestion(planQuestion, {
                            targetType: "recommendation",
                            targetId: recommendation.id,
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.assistantButtonText,
                            { color: colors.textMuted },
                          ]}
                        >
                          {planQuestion}
                        </Text>
                      </Pressable>
                    </View>

                    {isPlanChangeRecommendation(recommendation, matchedPlan) ? (
                      existingPendingRequest ? (
                        <View
                          style={[
                            styles.recommendationActionBox,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.smallText,
                              { color: colors.textSubtle },
                            ]}
                          >
                            Request already pending. Check Recent Requests for
                            the current upgrade or downgrade request status.
                          </Text>
                        </View>
                      ) : canRequest ? (
                        <Pressable
                          disabled={isCreating}
                          style={[
                            styles.primaryButton,
                            {
                              backgroundColor: primaryActionBackground,
                              borderColor: colors.primary,
                            },
                            isCreating && styles.primaryButtonDisabled,
                          ]}
                          onPress={() =>
                            void handleRequestPlanChange(recommendation, matchedPlan)
                          }
                        >
                          <Text
                            style={[
                              styles.primaryButtonText,
                              { color: primaryActionText },
                            ]}
                          >
                            {isCreating
                              ? "Sending..."
                              : getRecommendationActionLabel(recommendation, matchedPlan, selectedSubscription)}
                          </Text>
                        </Pressable>
                      ) : (
                        <View style={[
                            styles.recommendationActionBox,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.smallText,
                              { color: colors.textSubtle },
                            ]}
                          >
                            This recommendation does not include a direct target
                            plan. Open Service requests to choose a plan manually.
                          </Text>

                          {onOpenServiceRequests ? (
                            <Pressable
                              style={[
                                styles.primaryButton,
                                {
                                  backgroundColor: primaryActionBackground,
                                  borderColor: colors.primary,
                                },
                              ]}
                              onPress={onOpenServiceRequests}
                            >
                              <Text
                                style={[
                                  styles.primaryButtonText,
                                  { color: primaryActionText },
                                ]}
                              >
                                Open Service requests
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )
                    ) : null}
                  </View>
                );
              })}

              <PageControls
                page={safeRecommendationPage}
                pageCount={recommendationPageCount}
                onPageChange={setRecommendationPage}
                colors={colors}
                primaryActionBackground={primaryActionBackground}
                primaryActionText={primaryActionText}
              />
            </>
          ) : (
            <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
              No recent recommendations match this filter.
            </Text>
          )}
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Recent Requests
        </Text>
        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          Plan change requests stay visible here for context.
        </Text>

        {selectedPlanChangeRequests.slice(0, 3).length ? (
          selectedPlanChangeRequests.slice(0, 3).map((request) => (
            <View
              key={request.id}
              style={[
                styles.itemRow,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <View style={styles.itemHeader}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>
                  {formatLabel(request.request_type)}
                </Text>
                <Text
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.primary,
                    },
                  ]}
                >
                  {formatLabel(request.status)}
                </Text>
              </View>
              <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                Requested: {formatDateTime(request.requested_at)}
              </Text>
              {request.admin_response ? (
                <Text style={[styles.cardText, { color: colors.textMuted }]}>
                  Admin response: {request.admin_response}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No plan change requests yet.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function PageControls({
  page,
  pageCount,
  onPageChange,
  colors,
  primaryActionBackground,
  primaryActionText,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  colors: ReturnType<typeof usePulseFiTheme>["colors"];
  primaryActionBackground: string;
  primaryActionText: string;
}) {
  const visiblePages = Array.from(
    { length: Math.min(QUICK_PAGE_COUNT, pageCount) },
    (_, index) => index + 1
  );

  return (
    <View style={styles.pageRow}>
      <Pressable
        disabled={page <= 1}
        style={[
          styles.pageButton,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            opacity: page <= 1 ? 0.45 : 1,
          },
        ]}
        onPress={() => onPageChange(Math.max(page - 1, 1))}
      >
        <Text style={[styles.pageButtonText, { color: colors.primary }]}>
          Previous
        </Text>
      </Pressable>

      {visiblePages.map((pageNumber) => {
        const active = pageNumber === page;

        return (
          <Pressable
            key={pageNumber}
            style={[
              styles.pageNumberButton,
              {
                backgroundColor: active
                  ? primaryActionBackground
                  : colors.surfaceMuted,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onPageChange(pageNumber)}
          >
            <Text
              style={[
                styles.pageButtonText,
                { color: active ? primaryActionText : colors.textMuted },
              ]}
            >
              {pageNumber}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        disabled={page >= pageCount}
        style={[
          styles.pageButton,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            opacity: page >= pageCount ? 0.45 : 1,
          },
        ]}
        onPress={() => onPageChange(Math.min(page + 1, pageCount))}
      >
        <Text style={[styles.pageButtonText, { color: colors.primary }]}>
          Next
        </Text>
      </Pressable>
    </View>
  );
}

export default InsightsScreen;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  container: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 12,
    borderWidth: 1,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  smallText: {
    fontSize: 12,
    lineHeight: 17,
  },
  mutedText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "900",
  },
  itemRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    gap: 8,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemTitleGroup: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    textTransform: "capitalize",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    textTransform: "capitalize",
  },
  recommendationActionBox: {
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  assistantButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assistantButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  assistantButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
  errorCard: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  errorText: {
    fontSize: 14,
  },
  successCard: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  successText: {
    fontSize: 14,
  },
  pageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  pageButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pageNumberButton: {
    borderWidth: 1,
    borderRadius: 999,
    minWidth: 42,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
});

