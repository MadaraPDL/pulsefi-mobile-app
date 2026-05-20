import { apiRequest } from "./client";
import type { AppUserSummary } from "../types/appUser";

export function getMySummary() {
  return apiRequest<AppUserSummary>("/me/summary");
}
