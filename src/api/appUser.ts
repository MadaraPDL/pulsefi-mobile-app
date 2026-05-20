import { apiRequest } from "./client";
import type {
  AppUserSummary,
  MySubscription,
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
