import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  buildPulseFiAssistantContext,
  createPulseFiAssistantResponse,
  inferPulseFiAssistantIntent,
} from "../assistant/pulseFiAssistant";
import type { PulseFiAssistantResponse } from "../assistant/pulseFiAssistant";
import {
  getMyAlerts,
  getMyAvailablePlans,
  getMyDailyUsage,
  getMyDevices,
  getMyDeviceUsageList,
  getMyPlanChangeRequests,
  getMyPredictions,
  getMyRecommendations,
  getMyRouterCapabilities,
  getMyRouters,
  getMySubscriptions,
  getMyUsageSummary,
} from "../api/appUser";
import { useSelectedRouter } from "../state/SelectedRouterContext";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type {
  MyAlert,
  MyDailyUsage,
  MyDevice,
  MyDeviceUsage,
  MyPlanChangeRequest,
  MyPrediction,
  MyRecommendation,
  MyRouter,
  MyRouterCapabilities,
  MySubscription,
  MySubscriptionPlanSummary,
  MyUsageSummary,
} from "../types/appUser";

type PulseFiAssistantScreenProps = {
  initialQuestion?: string | null;
  initialQuestionKey?: number | null;
  onOpenInsights?: () => void;
  onOpenServiceRequests?: () => void;
};

type AssistantData = {
  routers: MyRouter[];
  subscriptions: MySubscription[];
  officialSummary: MyUsageSummary | null;
  estimatedSummary: MyUsageSummary | null;
  dailyUsage: MyDailyUsage[];
  devices: MyDevice[];
  deviceUsage: MyDeviceUsage[];
  alerts: MyAlert[];
  predictions: MyPrediction[];
  recommendations: MyRecommendation[];
  planChangeRequests: MyPlanChangeRequest[];
  availablePlans: MySubscriptionPlanSummary[];
  routerCapabilities: MyRouterCapabilities | null;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  response?: PulseFiAssistantResponse;
};

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi, I am PulseFi Assistant. Ask me about usage, recommendations, predictions, alerts, devices, or service requests for your selected router.",
};

const suggestedQuestions = [
  "Why is my usage high?",
  "Should I upgrade or downgrade?",
  "What does this prediction mean?",
  "Why am I getting this recommendation?",
  "Which devices are using the most data?",
  "What should I do about alerts?",
  "What is my latest service request status?",
];

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function getRouterDisplayName(router: MyRouter | null) {
  return router?.router_name ?? router?.router_model ?? "No router selected";
}

async function optionalApi<T>(request: Promise<T>, fallback: T) {
  try {
    return await request;
  } catch {
    return fallback;
  }
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PulseFiAssistantScreen({
  initialQuestion,
  initialQuestionKey,
  onOpenInsights,
  onOpenServiceRequests,
}: PulseFiAssistantScreenProps) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const consumedInitialQuestionKey = useRef<number | null>(null);
  const {
    selectedRouterId,
    setSelectedRouterId,
    usageDisplaySource,
  } = useSelectedRouter();

  const [data, setData] = useState<AssistantData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [draftQuestion, setDraftQuestion] = useState("");
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
      const effectiveRouter = matchingRouter ?? fallbackRouter;
      const effectiveRouterId = effectiveRouter?.id ?? null;

      if (effectiveRouterId && selectedRouterId !== effectiveRouterId) {
        setSelectedRouterId(effectiveRouterId);
      }

      const monthRange = getCurrentMonthRange();
      const todayRange = getTodayRange();

      const [
        officialSummary,
        estimatedSummary,
        dailyUsage,
        devices,
        deviceUsage,
        alerts,
        predictions,
        recommendations,
        planChangeRequests,
        availablePlans,
        routerCapabilities,
      ] = await Promise.all([
        effectiveRouterId
          ? optionalApi(
              getMyUsageSummary(effectiveRouterId, {
                startAt: monthRange.startAt,
                endAt: monthRange.endAt,
                sourceKind: "official",
              }),
              null
            )
          : Promise.resolve(null),
        effectiveRouterId
          ? optionalApi(
              getMyUsageSummary(effectiveRouterId, {
                startAt: monthRange.startAt,
                endAt: monthRange.endAt,
                sourceKind: "estimated",
              }),
              null
            )
          : Promise.resolve(null),
        effectiveRouterId
          ? optionalApi(
              getMyDailyUsage(1, effectiveRouterId, {
                startAt: todayRange.startAt,
                endAt: todayRange.endAt,
                sourceKind: usageDisplaySource,
              }),
              []
            )
          : Promise.resolve([]),
        effectiveRouterId
          ? optionalApi(getMyDevices(50, effectiveRouterId), [])
          : Promise.resolve([]),
        effectiveRouterId
          ? optionalApi(getMyDeviceUsageList(50, effectiveRouterId), [])
          : Promise.resolve([]),
        effectiveRouterId
          ? optionalApi(getMyAlerts(50, effectiveRouterId), [])
          : Promise.resolve([]),
        optionalApi(getMyPredictions(50), []),
        optionalApi(getMyRecommendations(50), []),
        optionalApi(getMyPlanChangeRequests(50), []),
        optionalApi(getMyAvailablePlans(), []),
        effectiveRouterId
          ? optionalApi(getMyRouterCapabilities(effectiveRouterId), null)
          : Promise.resolve(null),
      ]);

      setData({
        routers,
        subscriptions,
        officialSummary,
        estimatedSummary,
        dailyUsage,
        devices,
        deviceUsage,
        alerts,
        predictions,
        recommendations,
        planChangeRequests,
        availablePlans,
        routerCapabilities,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load PulseFi Assistant context."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRouterId, setSelectedRouterId, usageDisplaySource]);

  useEffect(() => {
    void loadAssistant();
  }, [loadAssistant]);

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

  const assistantContext = useMemo(
    () =>
      buildPulseFiAssistantContext({
        selectedRouter,
        selectedSubscription,
        usageDisplaySource,
        officialSummary: data?.officialSummary ?? null,
        estimatedSummary: data?.estimatedSummary ?? null,
        dailyUsage: data?.dailyUsage ?? [],
        devices: data?.devices ?? [],
        deviceUsage: data?.deviceUsage ?? [],
        alerts: data?.alerts ?? [],
        predictions: data?.predictions ?? [],
        recommendations: data?.recommendations ?? [],
        planChangeRequests: data?.planChangeRequests ?? [],
        availablePlans: data?.availablePlans ?? [],
        routerCapabilities: data?.routerCapabilities ?? null,
      }),
    [data, selectedRouter, selectedSubscription, usageDisplaySource]
  );

  const sendQuestion = useCallback(
    (question: string) => {
      const trimmedQuestion = question.trim();

      if (!trimmedQuestion) {
        return;
      }

      const intent = inferPulseFiAssistantIntent(trimmedQuestion);
      const response = createPulseFiAssistantResponse(assistantContext, intent);
      const userMessage: ChatMessage = {
        id: createMessageId("user"),
        role: "user",
        text: trimmedQuestion,
      };
      const assistantMessage: ChatMessage = {
        id: createMessageId("assistant"),
        role: "assistant",
        text: response.summary,
        response,
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        userMessage,
        assistantMessage,
      ]);
      setDraftQuestion("");
    },
    [assistantContext]
  );

  useEffect(() => {
    if (!data || !initialQuestion) {
      return;
    }

    const nextKey = initialQuestionKey ?? 0;

    if (consumedInitialQuestionKey.current === nextKey) {
      return;
    }

    consumedInitialQuestionKey.current = nextKey;
    sendQuestion(initialQuestion);
  }, [data, initialQuestion, initialQuestionKey, sendQuestion]);

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.mutedText}>Loading PulseFi Assistant...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.primary}
            onRefresh={() => void loadAssistant(true)}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PulseFi Assistant</Text>
          <Text style={styles.title}>Chat</Text>
          <Text style={styles.subtitle}>
            Local contextual answers for your selected router and service line.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Assistant context could not refresh</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.contextStrip}>
          <Text style={styles.contextTitle}>{getRouterDisplayName(selectedRouter)}</Text>
          <Text style={styles.contextText}>
            {selectedSubscription?.subscription_label ??
              selectedSubscription?.plan.plan_name ??
              "No linked service line"}
            {"  "}
            {usageDisplaySource === "official"
              ? "Official usage"
              : "Estimated usage"}
          </Text>
        </View>

        <View style={styles.chipRow}>
          {suggestedQuestions.map((question) => (
            <Pressable
              key={question}
              style={({ pressed }) => [
                styles.suggestionChip,
                { opacity: pressed ? 0.72 : 1 },
              ]}
              onPress={() => sendQuestion(question)}
            >
              <Text style={styles.suggestionText}>{question}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.messageList}>
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
        </View>

        <View style={styles.actionRow}>
          {onOpenInsights ? (
            <Pressable style={styles.secondaryAction} onPress={onOpenInsights}>
              <Ionicons name="bulb-outline" size={16} color={colors.text} />
              <Text style={styles.secondaryActionText}>Insights</Text>
            </Pressable>
          ) : null}
          {onOpenServiceRequests ? (
            <Pressable
              style={styles.secondaryAction}
              onPress={onOpenServiceRequests}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={16}
                color={colors.text}
              />
              <Text style={styles.secondaryActionText}>Service requests</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draftQuestion}
          placeholder="Ask PulseFi Assistant..."
          placeholderTextColor={colors.textSubtle}
          multiline
          onChangeText={setDraftQuestion}
          onSubmitEditing={() => sendQuestion(draftQuestion)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send question"
          disabled={!draftQuestion.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            {
              opacity: !draftQuestion.trim() ? 0.45 : pressed ? 0.78 : 1,
            },
          ]}
          onPress={() => sendQuestion(draftQuestion)}
        >
          <Ionicons name="send" size={18} color={colors.buttonText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      {isUser ? (
        <Text style={styles.userBubbleText}>{message.text}</Text>
      ) : message.response ? (
        <AssistantResponseBubble response={message.response} />
      ) : (
        <Text style={styles.assistantBubbleText}>{message.text}</Text>
      )}
    </View>
  );
}

function AssistantResponseBubble({
  response,
}: {
  response: PulseFiAssistantResponse;
}) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.responseContent}>
      <Text style={styles.responseTitle}>{response.title}</Text>
      <Text style={styles.assistantBubbleText}>{response.summary}</Text>

      {response.reasons.length ? (
        <BubbleSection title="What I noticed" rows={response.reasons} />
      ) : null}

      {response.nextSteps.length ? (
        <BubbleSection title="What you can do next" rows={response.nextSteps} />
      ) : null}

      {response.missingData.length ? (
        <BubbleSection
          title="Missing or unavailable data"
          rows={response.missingData}
        />
      ) : null}
    </View>
  );
}

function BubbleSection({ title, rows }: { title: string; rows: string[] }) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.bubbleSection}>
      <Text style={styles.bubbleSectionTitle}>{title}</Text>
      {rows.map((row) => (
        <View key={row} style={styles.bubbleRow}>
          <View style={styles.bubbleDot} />
          <Text style={styles.assistantBubbleText}>{row}</Text>
        </View>
      ))}
    </View>
  );
}

export default PulseFiAssistantScreen;

function createStyles(colors: ReturnType<typeof usePulseFiTheme>["colors"]) {
  const primaryTint =
    colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE";

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    messagesScroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    messagesContent: {
      flexGrow: 1,
      gap: 14,
      padding: 18,
      paddingBottom: 24,
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
    header: {
      gap: 6,
      paddingTop: 8,
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
    contextStrip: {
      borderRadius: 18,
      padding: 14,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    contextTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
    },
    contextText: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSubtle,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    suggestionChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: primaryTint,
    },
    suggestionText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.primary,
    },
    messageList: {
      gap: 12,
    },
    bubble: {
      maxWidth: "88%",
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
    },
    assistantBubble: {
      alignSelf: "flex-start",
      borderBottomLeftRadius: 6,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    userBubble: {
      alignSelf: "flex-end",
      borderBottomRightRadius: 6,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    assistantBubbleText: {
      flexShrink: 1,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    userBubbleText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.buttonText,
      fontWeight: "800",
    },
    responseContent: {
      gap: 10,
    },
    responseTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },
    bubbleSection: {
      gap: 7,
    },
    bubbleSectionTitle: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    bubbleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    bubbleDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 7,
      backgroundColor: colors.primary,
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    secondaryAction: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    secondaryActionText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.text,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      maxHeight: 110,
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
      backgroundColor: colors.background,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    mutedText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      color: colors.textSubtle,
    },
    errorCard: {
      borderRadius: 18,
      padding: 16,
      gap: 8,
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
      lineHeight: 20,
      color: colors.dangerText,
    },
  });
}
