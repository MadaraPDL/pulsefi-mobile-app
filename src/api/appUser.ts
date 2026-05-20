import { apiRequest } from "./client";
import type {
  AppUserSummary,
  MyAlert,
  MyDevice,
  MyDeviceUsage,
  MyPrediction,
  MyRecommendation,
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

export function getMyUsageSummary() {
  return apiRequest<MyUsageSummary>("/me/usage/summary");
}

export function getMyUsageRecords(limit = 20) {
  return apiRequest<MyUsageRecord[]>(`/me/usage/records?limit=${limit}`);
}

export function getMyDevices(limit = 50) {
  return apiRequest<MyDevice[]>(`/me/devices?limit=${limit}`);
}

export function getMyDeviceUsageList(limit = 50) {
  return apiRequest<MyDeviceUsage[]>(`/me/usage/devices?limit=${limit}`);
}

export function getMyAlerts(limit = 50) {
  return apiRequest<MyAlert[]>(`/me/alerts?limit=${limit}`);
}

export function markMyAlertAsRead(alertId: string) {
  return apiRequest<MyAlert>(`/me/alerts/${alertId}/read`, {
    method: "PATCH",
  });
}

export function getMyPredictions(limit = 20) {
  return apiRequest<MyPrediction[]>(`/me/predictions?limit=${limit}`);
}

export function getMyRecommendations(limit = 20) {
  return apiRequest<MyRecommendation[]>(`/me/recommendations?limit=${limit}`);
}
