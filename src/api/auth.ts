import { apiRequest } from "./client";
import type { AppUserSession } from "../types/appUser";

type LoginResponse =
  | AppUserSession
  | {
      mfa_required?: true;
      mfa_setup_required?: true;
      message?: string;
    };

export async function loginAppUser(identifier: string, password: string) {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      account_type: "app_user",
      identifier,
      password,
    }),
  });

  if ("mfa_required" in response || "mfa_setup_required" in response) {
    throw new Error(
      response.message ??
        "This account requires MFA. Mobile MFA screen will be added next."
    );
  }

  if (response.account_type !== "app_user") {
    throw new Error("This mobile app is only for App User accounts.");
  }

  return response;
}
