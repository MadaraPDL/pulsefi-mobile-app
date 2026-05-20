import { apiRequest } from "./client";
import type {
  AppUserSummary,
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
