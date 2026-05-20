import { apiRequest } from "./client";
import type {
  AppUserSummary,
  MyAlert,
  MyDevice,
  MyDevicePolicy,
  MyDevicePolicyExecution,
  MyDeviceUsage,
  MyPlanChangeRequest,
  MyPrediction,
  MyRecommendation,
  MyRouter,
  MyRouterCapabilities,
  MySubscription,
  MyUsageRecord,
  MyUsageSummary,
} from "../types/appUser";

export function getMySummary() {
  return apiRequest<AppUserSummary>("/me/summary");
}

export function getMySubscriptions() {
  return apiRequest<MySubscription[]>("/me/subscriptions");
}

export function getMySubscription(subscriptionId: string) {
  return apiRequest<MySubscription>(`/me/subscriptions/${subscriptionId}`);
}

export function getMyUsageSummary() {
  return apiRequest<MyUsageSummary>("/me/usage/summary");
}

export function getMyUsageRecords(limit = 20) {
  return apiRequest<MyUsageRecord[]>(`/me/usage/records?limit=${limit}`);
}

export function getMyDevices(limit = 50) {
  return apiRequest<MyDevice[]>(`/me/devices?limit=${limit}`);
}

export function getMyDevice(deviceId: string) {
  return apiRequest<MyDevice>(`/me/devices/${deviceId}`);
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

export function getMyDeviceUsageList(limit = 50) {
  return apiRequest<MyDeviceUsage[]>(`/me/usage/devices?limit=${limit}`);
}

export function getMyDeviceUsage(deviceId: string) {
  return apiRequest<MyDeviceUsage>(`/me/usage/devices/${deviceId}`);
}

export function getMyAlerts(limit = 50) {
  return apiRequest<MyAlert[]>(`/me/alerts?limit=${limit}`);
}

export function getMyAlert(alertId: string) {
  return apiRequest<MyAlert>(`/me/alerts/${alertId}`);
}

export function markMyAlertAsRead(alertId: string) {
  return apiRequest<MyAlert>(`/me/alerts/${alertId}/read`, {
    method: "PATCH",
  });
}

export function getMyPredictions(limit = 20) {
  return apiRequest<MyPrediction[]>(`/me/predictions?limit=${limit}`);
}

export function getMyPrediction(predictionId: string) {
  return apiRequest<MyPrediction>(`/me/predictions/${predictionId}`);
}

export function getMyRecommendations(limit = 20) {
  return apiRequest<MyRecommendation[]>(`/me/recommendations?limit=${limit}`);
}

export function getMyRecommendation(recommendationId: string) {
  return apiRequest<MyRecommendation>(`/me/recommendations/${recommendationId}`);
}

export function getMyPlanChangeRequests(limit = 20) {
  return apiRequest<MyPlanChangeRequest[]>(
    `/me/plan-change-requests?limit=${limit}`
  );
}

export function getMyPlanChangeRequest(requestId: string) {
  return apiRequest<MyPlanChangeRequest>(`/me/plan-change-requests/${requestId}`);
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

export function createDevicePriorityPolicy(deviceId: string, priorityLevel = 8) {
  return apiRequest<MyDevicePolicy>("/me/device-policies", {
    method: "POST",
    body: JSON.stringify({
      device_id: deviceId,
      policy_type: "device_priority",
      priority_level: priorityLevel,
    }),
  });
}

export function executeMyDevicePolicy(policyId: string) {
  return apiRequest<MyDevicePolicyExecution>(
    `/me/device-policies/${policyId}/execute`,
    {
      method: "PATCH",
    }
  );
}
