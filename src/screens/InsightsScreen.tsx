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

import { usePulseFiTheme } from "../theme/usePulseFiTheme";

import {
  createPlanChangeRequestFromRecommendation,
  getMyPlanChangeRequests,
  getMyPredictions,
  getMyRecommendations,
} from "../api/appUser";
import type {
  DecimalLike,
  MyPlanChangeRequest,
  MyPrediction,
  MyRecommendation,
} from "../types/appUser";

type InsightsData = {
  predictions: MyPrediction[];
  recommendations: MyRecommendation[];
  planChangeRequests: MyPlanChangeRequest[];
};

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
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [creatingRequestId, setCreatingRequestId] = useState<string | null>(null);
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

      const [predictions, recommendations, planChangeRequests] =
        await Promise.all([
          getMyPredictions(20),
          getMyRecommendations(20),
          getMyPlanChangeRequests(20),
        ]);

      setData({ predictions, recommendations, planChangeRequests });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load insights."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

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

      setSuccessMessage("Plan change request sent to your ISP admin.");
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
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>Loading insights...</Text>
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
          onRefresh={() => void loadInsights(true)}
        />
      }
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>Insights</Text>
      <Text style={[styles.title, { color: colors.text }]}>Predictions & recommendations</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        See predicted usage, risk level, recommendations, and plan change requests.
      </Text>

      {errorMessage ? (
        <View style={[styles.errorCard, { backgroundColor: colors.dangerBackground, borderColor: colors.dangerBorder }]}>
          <Text style={[styles.errorTitle, { color: colors.dangerText }]}>Action failed</Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View style={[styles.successCard, { backgroundColor: colors.successBackground, borderColor: colors.successBorder }]}>
          <Text style={[styles.successTitle, { color: colors.successText }]}>Request sent</Text>
          <Text style={[styles.successText, { color: colors.successText }]}>{successMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Predictions</Text>

        {data?.predictions.length ? (
          data.predictions.map((prediction) => (
            <View key={prediction.id} style={[styles.itemRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderTopColor: colors.border, borderTopWidth: 0, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 10 }]}>
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
          ))
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No predictions found yet. Run intelligence generation from the ISP
            Admin dashboard to create demo predictions.
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Recommendations</Text>

        {data?.recommendations.length ? (
          data.recommendations.map((recommendation) => {
            const isCreating = creatingRequestId === recommendation.id;
            const canRequest = canRequestPlanChange(recommendation);

            return (
              <View key={recommendation.id} style={[styles.itemRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderTopColor: colors.border, borderTopWidth: 0, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 10 }]}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleGroup}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>
                      {formatLabel(recommendation.recommendation_type)}
                    </Text>
                    <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                      {formatDate(recommendation.created_at)}
                    </Text>
                  </View>

                  <Text style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.primary }]}>
                    {formatLabel(recommendation.status)}
                  </Text>
                </View>

                <Text style={[styles.cardText, { color: colors.textMuted }]}>
                  {recommendation.recommendation_text}
                </Text>

                {recommendation.reason ? (
                  <Text style={[styles.smallText, { color: colors.textSubtle }]}>Reason: {recommendation.reason}</Text>
                ) : null}

                <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                  Confidence: {formatPercent(recommendation.confidence_score)}
                </Text>

                {canRequest ? (
                  <Pressable
                    disabled={isCreating}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.primary },
                      isCreating && styles.primaryButtonDisabled,
                    ]}
                    onPress={() => void handleRequestPlanChange(recommendation.id)}
                  >
                    <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
                      {isCreating ? "Sending..." : "Request plan change"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No recommendations found yet. Recommendations will appear after
            predictions are generated.
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Plan Change Requests</Text>

        {data?.planChangeRequests.length ? (
          data.planChangeRequests.map((request) => (
            <View key={request.id} style={[styles.itemRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderTopColor: colors.border, borderTopWidth: 0, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 10 }]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleGroup}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>
                    {formatLabel(request.request_type)}
                  </Text>
                  <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                    Requested: {formatDateTime(request.requested_at)}
                  </Text>
                </View>

                <Text style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.primary }]}>
                  {formatLabel(request.status)}
                </Text>
              </View>

              {request.reason ? (
                <Text style={[styles.cardText, { color: colors.textMuted }]}>{request.reason}</Text>
              ) : null}

              {request.admin_response ? (
                <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                  ISP response: {request.admin_response}
                </Text>
              ) : (
                <Text style={[styles.smallText, { color: colors.textSubtle }]}>
                  Waiting for ISP admin review.
                </Text>
              )}
            </View>
          ))
        ) : (
          <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
            No plan change requests yet. You can create one from an eligible
            recommendation.
          </Text>
        )}
      </View>
    </ScrollView>
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
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#33465B",
  },
  itemRow: {
    borderTopWidth: 1,
    borderTopColor: "#E3EAF2",
    paddingTop: 14,
    gap: 8,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  itemTitleGroup: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#102033",
    textTransform: "capitalize",
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    textTransform: "capitalize",
  },
  highRisk: {
    color: "#8A2E1B",
    backgroundColor: "#FFF3F0",
  },
  mediumRisk: {
    color: "#8A5B00",
    backgroundColor: "#FFF5D7",
  },
  lowRisk: {
    color: "#0B6B3A",
    backgroundColor: "#E9F8EF",
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    color: "#0B5D7A",
    backgroundColor: "#EAF9FE",
    overflow: "hidden",
    textTransform: "capitalize",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: "#102033",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
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
