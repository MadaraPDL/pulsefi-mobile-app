import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getMyPredictions, getMyRecommendations } from "../api/appUser";
import type {
  DecimalLike,
  MyPrediction,
  MyRecommendation,
} from "../types/appUser";

type InsightsData = {
  predictions: MyPrediction[];
  recommendations: MyRecommendation[];
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

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getRiskStyle(riskLevel: string) {
  const normalized = riskLevel.toLowerCase();

  if (normalized === "high" || normalized === "critical") {
    return styles.highRisk;
  }

  if (normalized === "medium" || normalized === "warning") {
    return styles.mediumRisk;
  }

  return styles.lowRisk;
}

export function InsightsScreen() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadInsights = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const [predictions, recommendations] = await Promise.all([
        getMyPredictions(20),
        getMyRecommendations(20),
      ]);

      setData({ predictions, recommendations });
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

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.mutedText}>Loading insights...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadInsights(true)}
        />
      }
    >
      <Text style={styles.eyebrow}>Insights</Text>
      <Text style={styles.title}>Predictions & recommendations</Text>
      <Text style={styles.subtitle}>
        See predicted usage, risk level, and plan recommendations.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not refresh insights</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Predictions</Text>

        {data?.predictions.length ? (
          data.predictions.map((prediction) => (
            <View key={prediction.id} style={styles.itemRow}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleGroup}>
                  <Text style={styles.itemTitle}>
                    {formatGb(prediction.predicted_usage_gb)}
                  </Text>
                  <Text style={styles.smallText}>
                    {formatDate(prediction.period_start)} →{" "}
                    {formatDate(prediction.period_end)}
                  </Text>
                </View>

                <Text style={[styles.pill, getRiskStyle(prediction.risk_level)]}>
                  {formatLabel(prediction.risk_level)}
                </Text>
              </View>

              <Text style={styles.cardText}>
                Confidence: {formatPercent(prediction.confidence_score)}
              </Text>
              <Text style={styles.smallText}>
                Model: {prediction.model_version ?? "Not specified"}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.mutedText}>
            No predictions found yet. Run intelligence generation from the ISP
            Admin dashboard to create demo predictions.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Recommendations</Text>

        {data?.recommendations.length ? (
          data.recommendations.map((recommendation) => (
            <View key={recommendation.id} style={styles.itemRow}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleGroup}>
                  <Text style={styles.itemTitle}>
                    {formatLabel(recommendation.recommendation_type)}
                  </Text>
                  <Text style={styles.smallText}>
                    {formatDate(recommendation.created_at)}
                  </Text>
                </View>

                <Text style={styles.statusPill}>
                  {formatLabel(recommendation.status)}
                </Text>
              </View>

              <Text style={styles.cardText}>
                {recommendation.recommendation_text}
              </Text>

              {recommendation.reason ? (
                <Text style={styles.smallText}>Reason: {recommendation.reason}</Text>
              ) : null}

              <Text style={styles.smallText}>
                Confidence: {formatPercent(recommendation.confidence_score)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.mutedText}>
            No recommendations found yet. Recommendations will appear after
            predictions are generated.
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    color: "#0B5D7A",
    backgroundColor: "#EAF9FE",
    overflow: "hidden",
    textTransform: "capitalize",
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
