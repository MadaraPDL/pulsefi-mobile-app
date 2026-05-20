import { apiRequest } from "./client";
import type {
  AppUserSummary,
  MyDevice,
  MyDeviceUsage,
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
