import type { UsageDisplaySource } from "../state/SelectedRouterContext";
import type {
  DecimalLike,
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

export type PulseFiAssistantIntent =
  | "overview"
  | "usage"
  | "recommendation"
  | "planDecision"
  | "prediction"
  | "devices"
  | "alerts"
  | "serviceRequests";

export type PulseFiAssistantResponse = {
  title: string;
  summary: string;
  reasons: string[];
  nextSteps: string[];
  missingData: string[];
  actions?: PulseFiAssistantAction[];
};

export type PulseFiAssistantActionTarget =
  | "usage"
  | "insights"
  | "devices"
  | "alerts"
  | "serviceRequests";

export type PulseFiAssistantAction = {
  label: string;
  target: PulseFiAssistantActionTarget;
};

export type PulseFiAssistantDataSource =
  | "routers"
  | "subscriptions"
  | "officialUsage"
  | "estimatedUsage"
  | "dailyUsage"
  | "devices"
  | "deviceUsage"
  | "alerts"
  | "predictions"
  | "recommendations"
  | "planChangeRequests"
  | "availablePlans"
  | "routerCapabilities";

export type PulseFiAssistantLoadState = "loaded" | "failed" | "empty";

export type PulseFiAssistantSourceStatus = Record<
  PulseFiAssistantDataSource,
  PulseFiAssistantLoadState
>;

export const defaultPulseFiAssistantSourceStatus: PulseFiAssistantSourceStatus = {
  routers: "empty",
  subscriptions: "empty",
  officialUsage: "empty",
  estimatedUsage: "empty",
  dailyUsage: "empty",
  devices: "empty",
  deviceUsage: "empty",
  alerts: "empty",
  predictions: "empty",
  recommendations: "empty",
  planChangeRequests: "empty",
  availablePlans: "empty",
  routerCapabilities: "empty",
};

const pulseFiAssistantDataSources = Object.keys(
  defaultPulseFiAssistantSourceStatus
) as PulseFiAssistantDataSource[];

type NormalizedUsageTotals = {
  totalMb: number;
  downloadMb: number;
  uploadMb: number;
  recordCount: number;
  firstRecordStart: string | null;
  lastRecordEnd: string | null;
};

export type PulseFiAssistantContext = {
  routerName: string | null;
  serviceLineName: string | null;
  planName: string | null;
  planLimitGb: number | null;
  planSpeedMbps: number | null;
  planPrice: number | null;
  usageDisplaySource: UsageDisplaySource;
  officialUsage: NormalizedUsageTotals;
  estimatedUsage: NormalizedUsageTotals;
  dailyUsage: MyDailyUsage[];
  devices: MyDevice[];
  deviceUsage: MyDeviceUsage[];
  alerts: MyAlert[];
  predictions: MyPrediction[];
  recommendations: MyRecommendation[];
  planChangeRequests: MyPlanChangeRequest[];
  availablePlans: MySubscriptionPlanSummary[];
  routerCapabilities: MyRouterCapabilities | null;
  sourceStatus: PulseFiAssistantSourceStatus;
};

type BuildPulseFiAssistantContextInput = {
  selectedRouter: MyRouter | null;
  selectedSubscription: MySubscription | null;
  usageDisplaySource: UsageDisplaySource;
  officialSummary?: MyUsageSummary | null;
  estimatedSummary?: MyUsageSummary | null;
  dailyUsage?: MyDailyUsage[];
  devices?: MyDevice[];
  deviceUsage?: MyDeviceUsage[];
  alerts?: MyAlert[];
  predictions?: MyPrediction[];
  recommendations?: MyRecommendation[];
  planChangeRequests?: MyPlanChangeRequest[];
  availablePlans?: MySubscriptionPlanSummary[];
  routerCapabilities?: MyRouterCapabilities | null;
  sourceStatus?: Partial<PulseFiAssistantSourceStatus>;
};

type AssistantResponseOptions = {
  prediction?: MyPrediction | null;
  recommendation?: MyRecommendation | null;
  request?: MyPlanChangeRequest | null;
  targetMissingNote?: string | null;
};

function toNumber(value: DecimalLike | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsageMb(value: number) {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} GB`;
  }

  return `${value.toFixed(0)} MB`;
}

function formatGb(value: DecimalLike | number) {
  return `${toNumber(value).toFixed(2)} GB`;
}

function formatPercent(value: DecimalLike | null | undefined) {
  if (value === null || value === undefined) {
    return "unknown";
  }

  const number = toNumber(value);
  return number <= 1 ? `${Math.round(number * 100)}%` : `${Math.round(number)}%`;
}

function formatMoney(value: number | null) {
  if (value === null) {
    return null;
  }

  return `$${value.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString();
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getRouterDisplayName(router: MyRouter | null) {
  return router?.router_name ?? router?.router_model ?? null;
}

function getServiceLineDisplayName(
  router: MyRouter | null,
  subscription: MySubscription | null
) {
  return (
    subscription?.subscription_label ??
    subscription?.plan.plan_name ??
    getRouterDisplayName(router)
  );
}

function normalizeUsageSummary(
  summary: MyUsageSummary | null | undefined
): NormalizedUsageTotals {
  const totals = summary?.totals;

  return {
    totalMb: toNumber(totals?.total_mb),
    downloadMb: toNumber(totals?.download_mb),
    uploadMb: toNumber(totals?.upload_mb),
    recordCount: totals?.record_count ?? 0,
    firstRecordStart: totals?.first_record_start ?? null,
    lastRecordEnd: totals?.last_record_end ?? null,
  };
}

function getDeviceDisplayName(device: MyDevice | MyDeviceUsage) {
  return device.device_name ?? device.device_type ?? "Unnamed device";
}

function getDeviceUsageTotal(device: MyDeviceUsage) {
  return toNumber(device.usage.total_mb);
}

function sortByNewest<T extends { created_at?: string; requested_at?: string }>(
  rows: T[]
) {
  return [...rows].sort((left, right) => {
    const leftDate = left.created_at ?? left.requested_at ?? "";
    const rightDate = right.created_at ?? right.requested_at ?? "";
    return new Date(rightDate).getTime() - new Date(leftDate).getTime();
  });
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getRecommendationSearchText(recommendation: MyRecommendation) {
  return [
    recommendation.recommendation_type,
    recommendation.recommendation_text,
    recommendation.reason ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function isStayOrNoChangeRecommendation(
  recommendation: MyRecommendation
) {
  const searchableText = normalizeSearchText(
    getRecommendationSearchText(recommendation)
  );

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

export function getRecommendationDirection(
  recommendation: MyRecommendation
): "upgrade" | "downgrade" | "stay" | "review" {
  if (isStayOrNoChangeRecommendation(recommendation)) {
    return "stay";
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
    recommendation.recommendation_plan_id !== null
  ) {
    return "upgrade";
  }

  return "review";
}

export function inferPulseFiAssistantIntent(
  question: string
): PulseFiAssistantIntent {
  const normalizedQuestion = normalizeSearchText(question);
  const weightedIntents: Record<
    Exclude<PulseFiAssistantIntent, "overview">,
    {
      specificity: number;
      keywords: Array<{ text: string; weight: number }>;
    }
  > = {
    prediction: {
      specificity: 90,
      keywords: [
        { text: "prediction", weight: 9 },
        { text: "predictions", weight: 9 },
        { text: "predict", weight: 8 },
        { text: "forecast", weight: 8 },
        { text: "projected", weight: 7 },
        { text: "projection", weight: 7 },
        { text: "risk", weight: 7 },
        { text: "confidence", weight: 7 },
      ],
    },
    recommendation: {
      specificity: 80,
      keywords: [
        { text: "why am i getting", weight: 10 },
        { text: "why did pulsefi recommend", weight: 10 },
        { text: "recommendation", weight: 9 },
        { text: "recommended", weight: 8 },
        { text: "recommend this", weight: 8 },
        { text: "suggestion", weight: 7 },
        { text: "suggested", weight: 7 },
      ],
    },
    planDecision: {
      specificity: 70,
      keywords: [
        { text: "should i upgrade", weight: 11 },
        { text: "should i downgrade", weight: 11 },
        { text: "upgrade", weight: 9 },
        { text: "downgrade", weight: 9 },
        { text: "switch plan", weight: 8 },
        { text: "switch package", weight: 8 },
        { text: "change plan", weight: 8 },
        { text: "change package", weight: 8 },
        { text: "package", weight: 5 },
        { text: "plan", weight: 4 },
      ],
    },
    devices: {
      specificity: 65,
      keywords: [
        { text: "devices", weight: 9 },
        { text: "device", weight: 9 },
        { text: "connected", weight: 7 },
        { text: "trusted", weight: 7 },
        { text: "untrusted", weight: 8 },
        { text: "bandwidth", weight: 8 },
        { text: "priority", weight: 8 },
      ],
    },
    alerts: {
      specificity: 55,
      keywords: [
        { text: "alerts", weight: 9 },
        { text: "alert", weight: 9 },
        { text: "warning", weight: 7 },
        { text: "severity", weight: 7 },
        { text: "critical", weight: 7 },
      ],
    },
    serviceRequests: {
      specificity: 50,
      keywords: [
        { text: "service request", weight: 11 },
        { text: "service requests", weight: 11 },
        { text: "request status", weight: 11 },
        { text: "requests", weight: 8 },
        { text: "request", weight: 8 },
        { text: "pending", weight: 7 },
        { text: "approved", weight: 7 },
        { text: "rejected", weight: 7 },
        { text: "status", weight: 5 },
      ],
    },
    usage: {
      specificity: 40,
      keywords: [
        { text: "usage", weight: 9 },
        { text: "official", weight: 8 },
        { text: "estimated", weight: 8 },
        { text: "monthly", weight: 7 },
        { text: "daily", weight: 7 },
        { text: "graph", weight: 7 },
        { text: "total", weight: 6 },
        { text: "data", weight: 4 },
        { text: "high", weight: 3 },
      ],
    },
  };

  let bestIntent: PulseFiAssistantIntent = "overview";
  let bestScore = 0;
  let bestSpecificity = 0;

  for (const [intent, config] of Object.entries(weightedIntents) as Array<
    [
      Exclude<PulseFiAssistantIntent, "overview">,
      (typeof weightedIntents)[Exclude<PulseFiAssistantIntent, "overview">],
    ]
  >) {
    const score = config.keywords.reduce((currentScore, keyword) => {
      const normalizedKeyword = normalizeSearchText(keyword.text);
      return normalizedQuestion.includes(normalizedKeyword)
        ? currentScore + keyword.weight
        : currentScore;
    }, 0);

    if (
      score > bestScore ||
      (score === bestScore && score > 0 && config.specificity > bestSpecificity)
    ) {
      bestIntent = intent;
      bestScore = score;
      bestSpecificity = config.specificity;
    }
  }

  return bestScore > 0 ? bestIntent : "overview";
}

function findRecommendedPlan(
  recommendation: MyRecommendation,
  context: PulseFiAssistantContext
) {
  if (!recommendation.recommendation_plan_id) {
    return null;
  }

  return (
    context.availablePlans.find(
      (plan) => plan.id === recommendation.recommendation_plan_id
    ) ?? null
  );
}

function createResponse(
  title: string,
  summary: string,
  reasons: string[] = [],
  nextSteps: string[] = [],
  missingData: string[] = [],
  actions: PulseFiAssistantAction[] = []
): PulseFiAssistantResponse {
  return {
    title,
    summary,
    reasons,
    nextSteps,
    missingData,
    actions,
  };
}

function getSelectedUsage(context: PulseFiAssistantContext) {
  return context.usageDisplaySource === "official"
    ? context.officialUsage
    : context.estimatedUsage;
}

function getUsageSourceLabel(source: UsageDisplaySource) {
  return source === "official"
    ? "official service total"
    : "estimated device total";
}

function getPlanPercent(usageMb: number, planLimitGb: number | null) {
  if (!planLimitGb || planLimitGb <= 0) {
    return null;
  }

  return Math.round((usageMb / (planLimitGb * 1024)) * 100);
}

const failedSourceNotes: Record<PulseFiAssistantDataSource, string> = {
  routers: "Routers could not refresh, so the selected-router context may be incomplete.",
  subscriptions:
    "Subscriptions could not refresh, so package and service-line details may be incomplete.",
  officialUsage:
    "Official usage could not refresh, so I cannot verify the latest service total right now.",
  estimatedUsage:
    "Estimated usage could not refresh, so I cannot verify the latest device estimate right now.",
  dailyUsage:
    "Daily usage could not refresh, so today's usage details may be missing.",
  devices: "Devices could not refresh, so the connected-device list may be incomplete.",
  deviceUsage:
    "Device usage could not refresh, so top-device totals may be missing.",
  alerts: "Alerts could not refresh, so I cannot verify the latest alert list right now.",
  predictions:
    "Predictions could not refresh, so I may not have the newest forecast.",
  recommendations:
    "Recommendations could not refresh, so I may not have the newest suggestion.",
  planChangeRequests:
    "Service requests could not refresh, so request status may be outdated.",
  availablePlans:
    "Available plans could not refresh, so target package details may be incomplete.",
  routerCapabilities:
    "Router capabilities could not refresh, so device limit and priority support may be unclear.",
};

function collectFailedSourceNotes(
  context: PulseFiAssistantContext,
  sources: PulseFiAssistantDataSource[]
) {
  return sources
    .filter((source) => context.sourceStatus[source] === "failed")
    .map((source) => failedSourceNotes[source]);
}

function appendUniqueNotes(target: string[], notes: string[]) {
  for (const note of notes) {
    if (!target.includes(note)) {
      target.push(note);
    }
  }
}

function getUsageStatusSource(source: UsageDisplaySource): PulseFiAssistantDataSource {
  return source === "official" ? "officialUsage" : "estimatedUsage";
}

export function buildPulseFiAssistantContext({
  selectedRouter,
  selectedSubscription,
  usageDisplaySource,
  officialSummary = null,
  estimatedSummary = null,
  dailyUsage = [],
  devices = [],
  deviceUsage = [],
  alerts = [],
  predictions = [],
  recommendations = [],
  planChangeRequests = [],
  availablePlans = [],
  routerCapabilities = null,
  sourceStatus = {},
}: BuildPulseFiAssistantContextInput): PulseFiAssistantContext {
  const serviceLineId =
    selectedRouter?.user_subscription_id ?? selectedSubscription?.id ?? null;
  const selectedRouterId = selectedRouter?.id ?? null;

  const selectedAlerts = serviceLineId
    ? alerts.filter((alert) => alert.user_subscription_id === serviceLineId)
    : [];

  const selectedPredictions = serviceLineId
    ? predictions.filter(
        (prediction) => prediction.user_subscription_id === serviceLineId
      )
    : [];

  const selectedRecommendations = serviceLineId
    ? recommendations.filter(
        (recommendation) =>
          recommendation.user_subscription_id === serviceLineId
      )
    : [];

  const selectedRequests = serviceLineId
    ? planChangeRequests.filter(
        (request) => request.user_subscription_id === serviceLineId
      )
    : [];

  const selectedDevices = selectedRouterId
    ? devices.filter((device) => device.router_id === selectedRouterId)
    : [];

  const selectedDeviceUsage = selectedRouterId
    ? deviceUsage.filter((device) => device.router_id === selectedRouterId)
    : [];

  return {
    routerName: getRouterDisplayName(selectedRouter),
    serviceLineName: getServiceLineDisplayName(
      selectedRouter,
      selectedSubscription
    ),
    planName: selectedSubscription?.plan.plan_name ?? null,
    planLimitGb: selectedSubscription
      ? toNumber(selectedSubscription.plan.data_limit_gb)
      : null,
    planSpeedMbps: selectedSubscription
      ? toNumber(selectedSubscription.plan.speed_limit_mbps)
      : null,
    planPrice: selectedSubscription
      ? toNumber(selectedSubscription.plan.monthly_price)
      : null,
    usageDisplaySource,
    officialUsage: normalizeUsageSummary(officialSummary),
    estimatedUsage: normalizeUsageSummary(estimatedSummary),
    dailyUsage,
    devices: selectedDevices,
    deviceUsage: selectedDeviceUsage,
    alerts: sortByNewest(selectedAlerts),
    predictions: sortByNewest(selectedPredictions),
    recommendations: sortByNewest(selectedRecommendations),
    planChangeRequests: sortByNewest(selectedRequests),
    availablePlans,
    routerCapabilities,
    sourceStatus: {
      ...defaultPulseFiAssistantSourceStatus,
      ...sourceStatus,
    },
  };
}

function answerOverview(context: PulseFiAssistantContext) {
  const missingData: string[] = [];
  const reasons: string[] = [];

  if (!context.routerName) {
    missingData.push("No selected router was loaded.");
  } else {
    reasons.push(`I am looking at ${context.routerName}.`);
  }

  if (context.serviceLineName) {
    reasons.push(`The current service line is ${context.serviceLineName}.`);
  } else {
    missingData.push("No service line was linked to the selected router.");
  }

  if (context.planName) {
    const price = formatMoney(context.planPrice);
    reasons.push(
      `The active package is ${context.planName}${
        price ? ` at ${price}/month` : ""
      }.`
    );
  } else {
    missingData.push("No active package details were loaded.");
  }

  reasons.push(
    `Usage guidance follows the ${getUsageSourceLabel(
      context.usageDisplaySource
    )} selected in the app.`
  );

  appendUniqueNotes(
    missingData,
    collectFailedSourceNotes(context, pulseFiAssistantDataSources)
  );

  return createResponse(
    "What I can help with",
    "I can explain the current router, usage, package, predictions, recommendations, alerts, devices, and service requests using only the data loaded for this signed-in App User.",
    reasons,
    [
      "Ask about usage when you want to understand official versus estimated totals.",
      "Ask about recommendations before requesting a plan change.",
      "Ask about devices or alerts when something looks unusual.",
    ],
    missingData,
    [
      { label: "Open Usage", target: "usage" },
      { label: "Open Insights", target: "insights" },
    ]
  );
}

function answerUsage(context: PulseFiAssistantContext) {
  const selectedUsage = getSelectedUsage(context);
  const official = context.officialUsage;
  const estimated = context.estimatedUsage;
  const planPercent = getPlanPercent(selectedUsage.totalMb, context.planLimitGb);
  const latestDailyUsage = context.dailyUsage[0]?.totals;
  const reasons: string[] = [];
  const nextSteps: string[] = [];
  const missingData: string[] = [];

  if (!context.routerName) {
    missingData.push("Select a router so usage can be scoped correctly.");
  }

  const selectedUsageStatusSource = getUsageStatusSource(
    context.usageDisplaySource
  );

  appendUniqueNotes(
    missingData,
    collectFailedSourceNotes(context, [
      "routers",
      "subscriptions",
      "officialUsage",
      "estimatedUsage",
      "dailyUsage",
    ])
  );

  if (
    selectedUsage.recordCount === 0 &&
    context.sourceStatus[selectedUsageStatusSource] !== "failed"
  ) {
    missingData.push(
      `No ${getUsageSourceLabel(context.usageDisplaySource)} records were loaded for this selected router.`
    );
  }

  reasons.push(
    `The selected ${getUsageSourceLabel(
      context.usageDisplaySource
    )} is ${formatUsageMb(selectedUsage.totalMb)}.`
  );

  if (latestDailyUsage) {
    reasons.push(
      `The loaded daily total is ${formatUsageMb(
        toNumber(latestDailyUsage.total_mb)
      )}.`
    );
  } else if (context.sourceStatus.dailyUsage !== "failed") {
    missingData.push("Daily usage was not loaded for this answer.");
  }

  if (planPercent !== null) {
    reasons.push(
      `That is about ${planPercent}% of the ${context.planLimitGb} GB package limit.`
    );
  } else {
    missingData.push("Plan limit data is unavailable, so I cannot calculate percent used.");
  }

  if (official.recordCount > 0 || estimated.recordCount > 0) {
    reasons.push(
      `Official shows ${formatUsageMb(
        official.totalMb
      )}; estimated shows ${formatUsageMb(estimated.totalMb)}.`
    );
    reasons.push(
      "Official totals come from service usage records, while estimated totals come from device-level records. They can differ when one source has fresher or more complete data."
    );
  }

  if (planPercent !== null && planPercent >= 85) {
    nextSteps.push("Check top devices first, then review recommendations before upgrading.");
  } else {
    nextSteps.push("Keep watching the Usage tab; the selected graph source controls the Home total too.");
  }

  nextSteps.push("Refresh if you expect newer router usage that is not showing yet.");

  return createResponse(
    "Usage explained",
    context.routerName
      ? `For ${context.routerName}, I am using the currently selected ${getUsageSourceLabel(
          context.usageDisplaySource
        )}.`
      : "I can explain usage once a router is selected.",
    reasons,
    nextSteps,
    missingData,
    [{ label: "Open Usage", target: "usage" }]
  );
}

function answerRecommendation(
  context: PulseFiAssistantContext,
  recommendation: MyRecommendation | null | undefined,
  forcePlanDecision = false,
  targetMissingNote: string | null | undefined = null
) {
  const target = recommendation ?? context.recommendations[0] ?? null;
  const missingData: string[] = [];

  if (targetMissingNote) {
    missingData.push(targetMissingNote);
  }

  appendUniqueNotes(
    missingData,
    collectFailedSourceNotes(context, [
      "subscriptions",
      "recommendations",
      "availablePlans",
      "planChangeRequests",
    ])
  );

  if (!target) {
    return createResponse(
      forcePlanDecision ? "Plan change guidance" : "Recommendation explained",
      "I do not see a recent recommendation loaded for this selected service line.",
      [
        context.serviceLineName
          ? `I checked ${context.serviceLineName}.`
          : "No service line context was loaded.",
      ],
      [
        "Open Insights after predictions/recommendations are generated.",
        "Use Service requests if you already know the plan change you want.",
      ],
      missingData.length
        ? missingData
        : ["Recommendation data is unavailable for this answer."],
      [
        { label: "Open Insights", target: "insights" },
        { label: "Open Service requests", target: "serviceRequests" },
      ]
    );
  }

  const direction = getRecommendationDirection(target);
  const targetPlan = findRecommendedPlan(target, context);
  const reasons = [target.recommendation_text];
  const nextSteps: string[] = [];

  if (target.reason) {
    reasons.push(`Reason shown by PulseFi: ${target.reason}`);
  }

  reasons.push(`Confidence is ${formatPercent(target.confidence_score)}.`);

  if (context.planName) {
    reasons.push(`Current package: ${context.planName}.`);
  } else {
    missingData.push("Current package details were not loaded.");
  }

  if (direction === "stay") {
    nextSteps.push("No plan request is needed for a stay/current-plan recommendation.");
    nextSteps.push("Keep monitoring usage and alerts for this router.");
  } else if (targetPlan) {
    nextSteps.push(`You can request ${targetPlan.plan_name} directly from this recommendation.`);
  } else if (target.recommendation_plan_id) {
    missingData.push("The target plan was referenced but its plan details were not loaded.");
    nextSteps.push("Refresh Insights, then try the recommendation action again.");
  } else if (direction === "upgrade" || direction === "downgrade") {
    nextSteps.push(
      "This recommendation does not include a direct target plan, so use Service requests to choose a plan manually."
    );
  } else {
    nextSteps.push("Review the recommendation text and compare it with your Usage tab before changing plans.");
  }

  const actions: PulseFiAssistantAction[] = [
    { label: "Open Insights", target: "insights" },
  ];

  if (direction !== "stay") {
    actions.push({
      label: "Open Service requests",
      target: "serviceRequests",
    });
  }

  return createResponse(
    forcePlanDecision ? "Should you change plan?" : "Recommendation explained",
    direction === "stay"
      ? "PulseFi is saying your current package appears acceptable based on the loaded recommendation."
      : "PulseFi is using the loaded recommendation, current package, and selected service line to explain the next action.",
    reasons,
    nextSteps,
    missingData,
    actions
  );
}

function answerPrediction(
  context: PulseFiAssistantContext,
  prediction: MyPrediction | null | undefined,
  targetMissingNote: string | null | undefined = null
) {
  const target = prediction ?? context.predictions[0] ?? null;
  const missingData: string[] = [];

  if (targetMissingNote) {
    missingData.push(targetMissingNote);
  }

  appendUniqueNotes(
    missingData,
    collectFailedSourceNotes(context, ["subscriptions", "predictions"])
  );

  if (!target) {
    return createResponse(
      "Prediction explained",
      "I do not see a recent prediction loaded for this selected service line.",
      [
        context.serviceLineName
          ? `I checked ${context.serviceLineName}.`
          : "No service line context was loaded.",
      ],
      [
        "Open Insights again after prediction records are generated.",
        "Use Usage for current totals while prediction data is unavailable.",
      ],
      missingData.length
        ? missingData
        : ["Prediction data is unavailable for this answer."],
      [
        { label: "Open Insights", target: "insights" },
        { label: "Open Usage", target: "usage" },
      ]
    );
  }

  const startDate = formatDate(target.period_start);
  const endDate = formatDate(target.period_end);
  const reasons = [
    `Predicted usage is ${formatGb(target.predicted_usage_gb)}${
      startDate && endDate ? ` for ${startDate} to ${endDate}` : ""
    }.`,
    `Risk level is ${formatLabel(target.risk_level)}.`,
    `Confidence is ${formatPercent(target.confidence_score)}.`,
  ];

  const nextSteps =
    target.risk_level.toLowerCase() === "high" ||
    target.risk_level.toLowerCase() === "critical"
      ? [
          "Check high-usage devices first.",
          "Review recommendations before changing package.",
          "Refresh usage if you expect newer router data.",
        ]
      : [
          "Keep monitoring usage through the month.",
          "Review recommendations if usage starts trending higher.",
        ];

  return createResponse(
    "Prediction explained",
    "This is a PulseFi prediction for the selected service line. It is a guidance signal, not a bill or guarantee.",
    reasons,
    nextSteps,
    missingData,
    [
      { label: "Open Insights", target: "insights" },
      { label: "Open Usage", target: "usage" },
    ]
  );
}

function answerDevices(context: PulseFiAssistantContext) {
  const sortedDeviceUsage = [...context.deviceUsage].sort(
    (left, right) => getDeviceUsageTotal(right) - getDeviceUsageTotal(left)
  );
  const topDevices = sortedDeviceUsage.slice(0, 3);
  const trustedCount = context.devices.filter((device) => device.is_trusted).length;
  const untrustedCount = Math.max(context.devices.length - trustedCount, 0);
  const reasons: string[] = [];
  const nextSteps: string[] = [];
  const missingData: string[] = [];

  if (!context.routerName) {
    missingData.push("No selected router was loaded.");
  }

  appendUniqueNotes(
    missingData,
    collectFailedSourceNotes(context, [
      "routers",
      "devices",
      "deviceUsage",
      "routerCapabilities",
    ])
  );

  if (!context.devices.length) {
    if (context.sourceStatus.devices !== "failed") {
      missingData.push("No connected devices were loaded for this selected router.");
    }
  } else {
    reasons.push(
      `${context.devices.length} device(s) are loaded: ${trustedCount} trusted and ${untrustedCount} untrusted.`
    );
  }

  if (topDevices.length) {
    reasons.push(
      `Top usage devices: ${topDevices
        .map(
          (device) =>
            `${getDeviceDisplayName(device)} (${formatUsageMb(
              getDeviceUsageTotal(device)
            )})`
        )
        .join(", ")}.`
    );
  } else {
    if (context.sourceStatus.deviceUsage !== "failed") {
      missingData.push("Device usage totals were not loaded.");
    }
  }

  if (context.routerCapabilities?.can_apply_bandwidth_limit) {
    nextSteps.push("This router supports bandwidth limits, so you can use device controls where available.");
  } else if (context.routerCapabilities) {
    nextSteps.push("This router does not report bandwidth-limit support.");
  } else {
    if (context.sourceStatus.routerCapabilities !== "failed") {
      missingData.push("Router capability data is unavailable, so I cannot confirm limits support.");
    }
  }

  if (context.routerCapabilities?.can_apply_device_priority) {
    nextSteps.push("This router supports device priority actions.");
  } else if (context.routerCapabilities) {
    nextSteps.push("This router does not report device-priority support.");
  }

  nextSteps.push("Mark devices as trusted only when you recognize them.");

  return createResponse(
    "Devices explained",
    "I am looking only at devices loaded for the selected router.",
    reasons,
    nextSteps,
    missingData,
    [{ label: "Open Devices", target: "devices" }]
  );
}

function answerAlerts(context: PulseFiAssistantContext) {
  const unreadAlerts = context.alerts.filter(
    (alert) => alert.read_at === null && alert.status.toLowerCase() !== "read"
  );
  const highAlerts = context.alerts.filter((alert) => {
    const severity = alert.severity.toLowerCase();
    return severity === "high" || severity === "critical";
  });
  const latestAlert = context.alerts[0] ?? null;
  const reasons: string[] = [];
  const nextSteps: string[] = [];
  const missingData: string[] = [];

  appendUniqueNotes(
    missingData,
    collectFailedSourceNotes(context, ["subscriptions", "alerts"])
  );

  if (!context.alerts.length) {
    if (context.sourceStatus.alerts !== "failed") {
      missingData.push("No alerts were loaded for this selected service line.");
    }
  } else {
    reasons.push(
      `${context.alerts.length} alert(s) are loaded, including ${unreadAlerts.length} unread and ${highAlerts.length} high-severity alert(s).`
    );
  }

  if (latestAlert) {
    reasons.push(
      `Latest alert: ${latestAlert.title} (${formatLabel(latestAlert.severity)}).`
    );
    reasons.push(latestAlert.message);
  }

  if (highAlerts.length) {
    nextSteps.push("Start with high-severity alerts, then check usage and device details.");
  } else {
    nextSteps.push("Read unread alerts and mark them read once you have reviewed them.");
  }

  nextSteps.push("If an alert looks wrong, refresh before taking action.");

  return createResponse(
    "Alerts explained",
    "Alerts are warning signals for the selected service line, not admin-only audit data.",
    reasons,
    nextSteps,
    missingData,
    [{ label: "Open Alerts", target: "alerts" }]
  );
}

function answerServiceRequests(
  context: PulseFiAssistantContext,
  request: MyPlanChangeRequest | null | undefined
) {
  const target = request ?? context.planChangeRequests[0] ?? null;
  const missingData: string[] = [];

  appendUniqueNotes(
    missingData,
    collectFailedSourceNotes(context, [
      "subscriptions",
      "planChangeRequests",
      "availablePlans",
    ])
  );

  if (!target) {
    return createResponse(
      "Service request status",
      "I do not see a recent service request loaded for this selected service line.",
      [
        context.serviceLineName
          ? `I checked ${context.serviceLineName}.`
          : "No service line context was loaded.",
      ],
      [
        "Use Service requests when you want to ask for a plan change or suspension.",
        "If a recommendation has no direct target plan, choose the plan manually there.",
      ],
      missingData.length
        ? missingData
        : ["Service request data is unavailable for this answer."],
      [{ label: "Open Service requests", target: "serviceRequests" }]
    );
  }

  const status = target.status.toLowerCase();
  const reasons = [
    `Latest request type: ${formatLabel(target.request_type)}.`,
    `Current status: ${formatLabel(target.status)}.`,
  ];
  const nextSteps: string[] = [];

  if (target.reason) {
    reasons.push(`Your request note: ${target.reason}`);
  }

  if (target.admin_response) {
    reasons.push(`ISP Admin response: ${target.admin_response}`);
  }

  if (status === "pending") {
    nextSteps.push("The request is waiting for ISP Admin review.");
  } else if (status === "approved" || status === "accepted") {
    nextSteps.push("The request was approved; check your package details after refresh.");
  } else if (status === "rejected") {
    nextSteps.push("Review the admin response and submit a clearer request if needed.");
  } else {
    nextSteps.push("Refresh Service requests for the latest status.");
  }

  return createResponse(
    "Service request status",
    "I am translating the loaded request status into normal user language.",
    reasons,
    nextSteps,
    missingData,
    [{ label: "Open Service requests", target: "serviceRequests" }]
  );
}

export function createPulseFiAssistantResponse(
  context: PulseFiAssistantContext,
  intent: PulseFiAssistantIntent,
  options: AssistantResponseOptions = {}
) {
  switch (intent) {
    case "usage":
      return answerUsage(context);
    case "recommendation":
      return answerRecommendation(
        context,
        options.recommendation,
        false,
        options.targetMissingNote
      );
    case "planDecision":
      return answerRecommendation(
        context,
        options.recommendation,
        true,
        options.targetMissingNote
      );
    case "prediction":
      return answerPrediction(
        context,
        options.prediction,
        options.targetMissingNote
      );
    case "devices":
      return answerDevices(context);
    case "alerts":
      return answerAlerts(context);
    case "serviceRequests":
      return answerServiceRequests(context, options.request);
    case "overview":
    default:
      return answerOverview(context);
  }
}
