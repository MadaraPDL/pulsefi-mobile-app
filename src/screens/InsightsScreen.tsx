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
  createPlanChangeRequestFromRecommendation,
  getMyPlanChangeRequests,
  getMyPredictions,
  getMyRecommendations,
  getMyRouters,
  getMySubscriptions,
} from "../api/appUser";
import { useSelectedRouter } from "../state/SelectedRouterContext";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type {
  DecimalLike,
  MyPlanChangeRequest,
  MyPrediction,
  MyRecommendation,
  MyRouter,
  MySubscription,
} from "../types/appUser";

type InsightsData = {
  predictions: MyPrediction[];
  recommendations: MyRecommendation[];
  planChangeRequests: MyPlanChangeRequest[];
  routers: MyRouter[];
  subscriptions: MySubscription[];
};

type InsightPeriodMode = "monthly" | "daily";
type RecommendationStatusFilter = "all" | "pending" | "accepted" | "rejected";

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

function getMonthDate(monthOffset: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
}

function getDayDate(dayOffset: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
}

function getMonthRange(monthOffset: number) {
  const month = getMonthDate(monthOffset);
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  return {
    start,
    end,
    label: start.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    }),
  };
}

function getDayRange(dayOffset: number) {
  const day = getDayDate(dayOffset);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);

  return {
    start,
    end,
    label: start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
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

function isDateInsideRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return timestamp >= start.getTime() && timestamp < end.getTime();
}

function predictionOverlapsRange(prediction: MyPrediction, start: Date, end: Date) {
  const periodStart = new Date(prediction.period_start).getTime();
  const periodEnd = new Date(prediction.period_end).getTime();

  if (Number.isNaN(periodStart) || Number.isNaN(periodEnd)) {
    return isDateInsideRange(prediction.created_at, start, end);
  }

  return periodStart < end.getTime() && periodEnd >= start.getTime();
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

function canRequestPlanChange(recommendation: MyRecommendation) {
  const type = recommendation.recommendation_type.toLowerCase();
  const status = recommendation.status.toLowerCase();

  return (
    recommendation.recommendation_plan_id !== null &&
    (type === "upgrade" || type === "downgrade") &&
    status !== "accepted" &&
    status !== "rejected"
  );
}

export function InsightsScreen() {
  const { colors } = usePulseFiTheme();
  const { selectedRouterId, setSelectedRouterId } = useSelectedRouter();
  const primaryActionBackground =
    colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE";
  const primaryActionText = colors.mode === "dark" ? colors.primary : "#0B5D7A";

  const [data, setData] = useState<InsightsData | null>(null);
  const [periodMode, setPeriodMode] = useState<InsightPeriodMode>("monthly");
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [predictionPage, setPredictionPage] = useState(1);
  const [recommendationPage, setRecommendationPage] = useState(1);
  const [recommendationStatusFilter, setRecommendationStatusFilter] =
    useState<RecommendationStatusFilter>("all");
  const [creatingRequestId, setCreatingRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeRange = useMemo(() => {
    return periodMode === "monthly"
      ? getMonthRange(monthOffset)
      : getDayRange(dayOffset);
  }, [dayOffset, monthOffset, periodMode]);

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
      ] = await Promise.all([
        getMyPredictions(100),
        getMyRecommendations(100),
        getMyPlanChangeRequests(50),
        getMyRouters(),
        getMySubscriptions(),
      ]);

      setData({
        predictions,
        recommendations,
        planChangeRequests,
        routers,
        subscriptions,
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

  const periodPredictions = useMemo(() => {
    if (!selectedServiceLineId) {
      return [];
    }

    return (data?.predictions ?? []).filter(
      (prediction) =>
        prediction.user_subscription_id === selectedServiceLineId &&
        isWithinUserVisibleWindow(prediction.created_at ?? prediction.prediction_date) &&
        predictionOverlapsRange(prediction, activeRange.start, activeRange.end)
    );
  }, [activeRange.end, activeRange.start, data?.predictions, selectedServiceLineId]);

  const periodPredictionIds = useMemo(() => {
    return new Set(periodPredictions.map((prediction) => prediction.id));
  }, [periodPredictions]);

  const periodRecommendations = useMemo(() => {
    if (!selectedServiceLineId) {
      return [];
    }

    return (data?.recommendations ?? []).filter((recommendation) => {
      if (recommendation.user_subscription_id !== selectedServiceLineId) {
        return false;
      }

      if (!isWithinUserVisibleWindow(recommendation.created_at)) {
        return false;
      }

      const belongsToVisiblePrediction =
        recommendation.prediction_id !== null &&
        periodPredictionIds.has(recommendation.prediction_id);

      return (
        belongsToVisiblePrediction ||
        isDateInsideRange(recommendation.created_at, activeRange.start, activeRange.end)
      );
    });
  }, [
    activeRange.end,
    activeRange.start,
    data?.recommendations,
    periodPredictionIds,
    selectedServiceLineId,
  ]);

  const filteredRecommendations = useMemo(() => {
    return periodRecommendations.filter((recommendation) => {
      if (recommendationStatusFilter === "all") {
        return true;
      }

      return recommendation.status.toLowerCase() === recommendationStatusFilter;
    });
  }, [periodRecommendations, recommendationStatusFilter]);

  const selectedPlanChangeRequests = useMemo(() => {
    if (!selectedServiceLineId) {
      return [];
    }

    return (data?.planChangeRequests ?? []).filter(
      (request) => request.user_subscription_id === selectedServiceLineId
    );
  }, [data?.planChangeRequests, selectedServiceLineId]);

  const predictionPageCount = getPageCount(periodPredictions.length);
  const safePredictionPage = Math.min(predictionPage, predictionPageCount);
  const paginatedPredictions = periodPredictions.slice(
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
  }, [activeRange.label, periodMode, selectedServiceLineId]);

  useEffect(() => {
    setRecommendationPage(1);
  }, [recommendationStatusFilter]);

  async function handleRequestPlanChange(recommendationId: string) {
    try {
      setCreatingRequestId(recommendationId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const createdRequest =
        await createPlanChangeRequestFromRecommendation(recommendationId);

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          planChangeRequests: [createdRequest, ...current.planChangeRequests],
          recommendations: current.recommendations.map((recommendation) =>
            recommendation.id === recommendationId
              ? { ...recommendation, status: "accepted" }
              : recommendation
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
        Choose a month or day, then review only the matching insights.
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
        {(["monthly", "daily"] as InsightPeriodMode[]).map((option) => {
          const active = periodMode === option;

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
              onPress={() => setPeriodMode(option)}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  { color: active ? primaryActionText : colors.textMuted },
                ]}
              >
                {option === "monthly" ? "Monthly" : "Daily"}
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

      <View style={styles.periodRow}>
        <Pressable
          style={[
            styles.periodButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => {
            if (periodMode === "monthly") {
              setMonthOffset((current) => current + 1);
            } else {
              setDayOffset((current) => current + 1);
            }
          }}
        >
          <Text style={[styles.periodButtonText, { color: colors.primary }]}>
            Previous {periodMode === "monthly" ? "month" : "day"}
          </Text>
        </Pressable>

        <View style={styles.periodTitleWrap}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            {periodMode === "monthly" ? "Month" : "Day"}
          </Text>
          <Text style={[styles.periodTitle, { color: colors.text }]}>
            {activeRange.label}
          </Text>
        </View>

        <Pressable
          disabled={periodMode === "monthly" ? monthOffset === 0 : dayOffset === 0}
          style={[
            styles.periodButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity:
                periodMode === "monthly"
                  ? monthOffset === 0
                    ? 0.45
                    : 1
                  : dayOffset === 0
                    ? 0.45
                    : 1,
            },
          ]}
          onPress={() => {
            if (periodMode === "monthly") {
              setMonthOffset((current) => Math.max(current - 1, 0));
            } else {
              setDayOffset((current) => Math.max(current - 1, 0));
            }
          }}
        >
          <Text style={[styles.periodButtonText, { color: colors.primary }]}>
            Next {periodMode === "monthly" ? "month" : "day"}
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
              Predictions
            </Text>
            <Text style={[styles.smallText, { color: colors.textSubtle }]}>
              {periodPredictions.length} recent prediction(s) for {activeRange.label}
            </Text>
          </View>
        </View>

        {periodPredictions.length ? (
          <>
            {paginatedPredictions.map((prediction) => (
              <View
                key={prediction.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleGroup}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>
                      {formatGb(prediction.predicted_usage_gb)}
                    </Text>
                    <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                      {formatDate(prediction.period_start)} →{" "}
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
            No recent predictions found for this {periodMode === "monthly" ? "month" : "day"}.
          </Text>
        )}
      </View>

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
          {filteredRecommendations.length} recent recommendation(s) for{" "}
          {activeRange.label}
        </Text>

        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: `All (${periodRecommendations.length})` },
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
              const isCreating = creatingRequestId === recommendation.id;
              const canRequest = canRequestPlanChange(recommendation);

              return (
                <View
                  key={recommendation.id}
                  style={[
                    styles.itemRow,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
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

                  {canRequest ? (
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
                      onPress={() => void handleRequestPlanChange(recommendation.id)}
                    >
                      <Text
                        style={[
                          styles.primaryButtonText,
                          { color: primaryActionText },
                        ]}
                      >
                        {isCreating ? "Sending..." : "Request for selected router"}
                      </Text>
                    </Pressable>
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
            No recent recommendations match this period and filter.
          </Text>
        )}
      </View>

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
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  periodTitleWrap: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  periodTitle: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  periodButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
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
