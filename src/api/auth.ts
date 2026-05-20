import { apiRequest } from "./client";
import type { AppUserSession } from "../types/appUser";

type MfaLoginResponse = {
  mfa_required?: true;
  mfa_setup_required?: true;
  message?: string;
};

type LoginResponse = AppUserSession | MfaLoginResponse;

function isAppUserSession(response: LoginResponse): response is AppUserSession {
  return "access_token" in response && response.account_type === "app_user";
}

export async function loginAppUser(
  identifier: string,
  password: string
): Promise<AppUserSession> {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      account_type: "app_user",
      identifier,
      password,
    }),
  });

  if (!isAppUserSession(response)) {
    throw new Error(
      response.message ??
        "This account requires MFA. Mobile MFA screen will be added next."
    );
  }

  return response;
}
