import { apiRequest } from "./client";
function buildQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const rendered = query.toString();
  return rendered ? `?${rendered}` : "";
}

import type {
  AppUserSummary,
  MyAlert,
  MyDevice,
  MyDevicePolicy,
  MyDevicePolicyExecution,
  MyDailyUsage,
  MyDeviceUsage,
  MyPlanChangeRequest,
  MyPrediction,
  MyRecommendation,
  MyRouter,
  MyRouterCapabilities,
  MySubscription,
  MySubscriptionPlanSummary,
  MyUsageRecord,
  MyUsageSummary,
} from "../types/appUser";

export function getMySummary() {
  return apiRequest<AppUserSummary>("/me/summary");
}

export function getMySubscriptions() {
  return apiRequest<MySubscription[]>("/me/subscriptions");
}

export function getMyAvailablePlans() {
  return apiRequest<MySubscriptionPlanSummary[]>("/me/plans");
}

export function getMySubscription(subscriptionId: string) {
  return apiRequest<MySubscription>(`/me/subscriptions/${subscriptionId}`);
}

export type UsageSourceKind = "official" | "estimated";

export function getMyUsageSummary(
  routerId?: string | null,
  options: {
    startAt?: string | null;
    endAt?: string | null;
    sourceKind?: UsageSourceKind | null;
  } = {}
) {
  return apiRequest<MyUsageSummary>(
    `/me/usage/summary${buildQuery({
      router_id: routerId,
      start_at: options.startAt,
      end_at: options.endAt,
      source_kind: options.sourceKind,
    })}`
  );
}

export function getMyUsageRecords(
  limit = 20,
  routerId?: string | null,
  options: {
    offset?: number;
    startAt?: string | null;
    endAt?: string | null;
    sourceKind?: UsageSourceKind | null;
  } = {}
) {
  return apiRequest<MyUsageRecord[]>(
    `/me/usage/records${buildQuery({
      limit,
      offset: options.offset ?? 0,
      router_id: routerId,
      start_at: options.startAt,
      end_at: options.endAt,
      source_kind: options.sourceKind,
    })}`
  );
}

export function getMyDailyUsage(
  days = 7,
  routerId?: string | null,
  options: {
    startAt?: string | null;
    endAt?: string | null;
    sourceKind?: UsageSourceKind | null;
  } = {}
) {
  return apiRequest<MyDailyUsage[]>(
    `/me/usage/daily${buildQuery({
      days,
      router_id: routerId,
      start_at: options.startAt,
      end_at: options.endAt,
      source_kind: options.sourceKind,
    })}`
  );
}


export function getMyDevices(limit = 50, routerId?: string | null) {
  return apiRequest<MyDevice[]>(
    `/me/devices${buildQuery({ limit, router_id: routerId })}`
  );
}

export function getMyDevice(deviceId: string) {
  return apiRequest<MyDevice>(`/me/devices/${deviceId}`);
}

export function updateMyDeviceTrust(deviceId: string, isTrusted: boolean) {
  return apiRequest<MyDevice>(`/me/devices/${deviceId}/trust`, {
    method: "PATCH",
    body: JSON.stringify({ is_trusted: isTrusted }),
  });
}

export function getMyRouters() {
  return apiRequest<MyRouter[]>("/me/routers");
}

export function getMyRouter(routerId: string) {
  return apiRequest<MyRouter>(`/me/routers/${routerId}`);
}

export function getMyRouterCapabilities(routerId: string) {
  return apiRequest<MyRouterCapabilities>(`/me/routers/${routerId}/capabilities`);
}

export function getMyDeviceUsageList(
  limit = 50,
  routerId?: string | null,
  options: {
    offset?: number;
    startAt?: string | null;
    endAt?: string | null;
  } = {}
) {
  return apiRequest<MyDeviceUsage[]>(
    `/me/usage/devices${buildQuery({
      limit,
      offset: options.offset ?? 0,
      router_id: routerId,
      start_at: options.startAt,
      end_at: options.endAt,
    })}`
  );
}

export function getMyDeviceUsage(deviceId: string) {
  return apiRequest<MyDeviceUsage>(`/me/usage/devices/${deviceId}`);
}

export function getMyAlerts(limit = 50, routerId?: string | null) {
  return apiRequest<MyAlert[]>(
    `/me/alerts${buildQuery({ limit, router_id: routerId })}`
  );
}

export function getMyAlert(alertId: string) {
  return apiRequest<MyAlert>(`/me/alerts/${alertId}`);
}

export function markMyAlertAsRead(alertId: string) {
  return apiRequest<MyAlert>(`/me/alerts/${alertId}/read`, {
    method: "PATCH",
  });
}

export function getMyPredictions(limit = 20, offset = 0) {
  return apiRequest<MyPrediction[]>(
    `/me/predictions${buildQuery({ limit, offset })}`
  );
}

export function getMyPrediction(predictionId: string) {
  return apiRequest<MyPrediction>(`/me/predictions/${predictionId}`);
}

export function getMyRecommendations(limit = 20, offset = 0) {
  return apiRequest<MyRecommendation[]>(
    `/me/recommendations${buildQuery({ limit, offset })}`
  );
}

export function getMyRecommendation(recommendationId: string) {
  return apiRequest<MyRecommendation>(`/me/recommendations/${recommendationId}`);
}

export function getMyPlanChangeRequests(limit = 20, offset = 0) {
  return apiRequest<MyPlanChangeRequest[]>(
    `/me/plan-change-requests${buildQuery({ limit, offset })}`
  );
}

export function getMyPlanChangeRequest(requestId: string) {
  return apiRequest<MyPlanChangeRequest>(`/me/plan-change-requests/${requestId}`);
}

export type MySubscriptionRequestType =
  | "upgrade"
  | "downgrade"
  | "suspend_subscription"
  | "suspend_account";

export function createMyPlanChangeRequest(data: {
  user_subscription_id: string;
  requested_plan_id?: string | null;
  request_type: MySubscriptionRequestType;
  reason?: string | null;
  confirmation_text: string;
}) {
  return apiRequest<MyPlanChangeRequest>("/me/plan-change-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createPlanChangeRequestFromRecommendation(
  recommendationId: string,
  reason = "Requested from PulseFi mobile app recommendation."
) {
  return apiRequest<MyPlanChangeRequest>(
    `/me/recommendations/${recommendationId}/plan-change-request`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  );
}


export function getMyDevicePolicies(limit = 50) {
  return apiRequest<MyDevicePolicy[]>(`/me/device-policies?limit=${limit}`);
}

export function getMyDevicePolicy(policyId: string) {
  return apiRequest<MyDevicePolicy>(`/me/device-policies/${policyId}`);
}

export function createBandwidthLimitPolicy(
  deviceId: string,
  downloadLimitMbps: number,
  uploadLimitMbps: number
) {
  return apiRequest<MyDevicePolicy>("/me/device-policies", {
    method: "POST",
    body: JSON.stringify({
      device_id: deviceId,
      policy_type: "bandwidth_limit",
      download_limit_mbps: downloadLimitMbps,
      upload_limit_mbps: uploadLimitMbps,
    }),
  });
}

export function createDevicePriorityPolicy(deviceId: string, priorityLevel = 5) {
  return apiRequest<MyDevicePolicy>("/me/device-policies", {
    method: "POST",
    body: JSON.stringify({
      device_id: deviceId,
      policy_type: "device_priority",
      priority_level: priorityLevel,
    }),
  });
}

export function deactivateMyDevicePolicy(policyId: string) {
  return apiRequest<MyDevicePolicy>(
    `/me/device-policies/${policyId}/deactivate`,
    {
      method: "PATCH",
    }
  );
}

export function executeMyDevicePolicy(policyId: string) {
  return apiRequest<MyDevicePolicyExecution>(
    `/me/device-policies/${policyId}/execute`,
    {
      method: "PATCH",
    }
  );
}

