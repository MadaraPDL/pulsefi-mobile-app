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
};

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
};

type AssistantResponseOptions = {
  prediction?: MyPrediction | null;
  recommendation?: MyRecommendation | null;
  request?: MyPlanChangeRequest | null;
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

  if (
    ["device", "devices", "trusted", "untrusted", "connected", "bandwidth", "priority"].some(
      (signal) => normalizedQuestion.includes(signal)
    )
  ) {
    return "devices";
  }

  if (
    [
      "usage",
      "data",
      "high",
      "official",
      "estimated",
      "graph",
      "total",
      "monthly",
      "daily",
    ].some((signal) => normalizedQuestion.includes(signal))
  ) {
    return "usage";
  }

  if (
    [
      "recommendation",
      "recommended",
      "why am i getting",
      "suggestion",
      "suggest",
    ].some((signal) => normalizedQuestion.includes(signal))
  ) {
    return "recommendation";
  }

  if (
    [
      "upgrade",
      "downgrade",
      "change plan",
      "change package",
      "switch plan",
      "switch package",
      "plan",
      "package",
    ].some((signal) => normalizedQuestion.includes(signal))
  ) {
    return "planDecision";
  }

  if (
    ["prediction", "predict", "forecast", "risk", "confidence"].some((signal) =>
      normalizedQuestion.includes(signal)
    )
  ) {
    return "prediction";
  }

  if (
    ["alert", "alerts", "warning", "severity", "critical", "read"].some(
      (signal) => normalizedQuestion.includes(signal)
    )
  ) {
    return "alerts";
  }

  if (
    ["request", "requests", "pending", "approved", "rejected", "status"].some(
      (signal) => normalizedQuestion.includes(signal)
    )
  ) {
    return "serviceRequests";
  }

  return "overview";
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
  missingData: string[] = []
): PulseFiAssistantResponse {
  return {
    title,
    summary,
    reasons,
    nextSteps,
    missingData,
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

  return createResponse(
    "What I can help with",
    "I can explain the current router, usage, package, predictions, recommendations, alerts, devices, and service requests using only the data loaded for this signed-in App User.",
    reasons,
    [
      "Ask about usage when you want to understand official versus estimated totals.",
      "Ask about recommendations before requesting a plan change.",
      "Ask about devices or alerts when something looks unusual.",
    ],
    missingData
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

  if (selectedUsage.recordCount === 0) {
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
  } else {
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
    missingData
  );
}

function answerRecommendation(
  context: PulseFiAssistantContext,
  recommendation: MyRecommendation | null | undefined,
  forcePlanDecision = false
) {
  const target = recommendation ?? context.recommendations[0] ?? null;
  const missingData: string[] = [];

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
      ["Recommendation data is unavailable for this answer."]
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

  return createResponse(
    forcePlanDecision ? "Should you change plan?" : "Recommendation explained",
    direction === "stay"
      ? "PulseFi is saying your current package appears acceptable based on the loaded recommendation."
      : "PulseFi is using the loaded recommendation, current package, and selected service line to explain the next action.",
    reasons,
    nextSteps,
    missingData
  );
}

function answerPrediction(
  context: PulseFiAssistantContext,
  prediction: MyPrediction | null | undefined
) {
  const target = prediction ?? context.predictions[0] ?? null;

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
      ["Prediction data is unavailable for this answer."]
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
    nextSteps
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

  if (!context.devices.length) {
    missingData.push("No connected devices were loaded for this selected router.");
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
    missingData.push("Device usage totals were not loaded.");
  }

  if (context.routerCapabilities?.can_apply_bandwidth_limit) {
    nextSteps.push("This router supports bandwidth limits, so you can use device controls where available.");
  } else if (context.routerCapabilities) {
    nextSteps.push("This router does not report bandwidth-limit support.");
  } else {
    missingData.push("Router capability data is unavailable, so I cannot confirm limits support.");
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
    missingData
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

  if (!context.alerts.length) {
    missingData.push("No alerts were loaded for this selected service line.");
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
    missingData
  );
}

function answerServiceRequests(
  context: PulseFiAssistantContext,
  request: MyPlanChangeRequest | null | undefined
) {
  const target = request ?? context.planChangeRequests[0] ?? null;

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
      ["Service request data is unavailable for this answer."]
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
    nextSteps
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
      return answerRecommendation(context, options.recommendation, false);
    case "planDecision":
      return answerRecommendation(context, options.recommendation, true);
    case "prediction":
      return answerPrediction(context, options.prediction);
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
