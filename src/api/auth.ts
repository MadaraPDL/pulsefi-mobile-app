import { apiRequest } from "./client";
import type { AppUserSession, CurrentAccount } from "../types/appUser";

export type MFAMethod = "email" | "authenticator";

export type MFARequiredResponse = {
  mfa_required: true;
  challenge_token: string;
  method: MFAMethod;
  active_methods: MFAMethod[];
  backup_codes_available: boolean;
  expires_at: string;
  message: string;
};

export type MFASetupRequiredResponse = {
  mfa_setup_required: true;
  message: string;
  account_type: "admin" | "app_user";
  account_id: string;
  method: "authenticator";
  mfa_setup_token: string;
  authenticator_secret: string;
  authenticator_uri: string;
};

export type LoginResponse =
  | AppUserSession
  | MFARequiredResponse
  | MFASetupRequiredResponse;

export type AppUserLoginResult =
  | {
      kind: "authenticated";
      session: AppUserSession;
    }
  | {
      kind: "mfa_required";
      challenge: MFARequiredResponse;
      identifier: string;
    }
  | {
      kind: "mfa_setup_required";
      setup: MFASetupRequiredResponse;
      identifier: string;
    };

function isAppUserSession(response: LoginResponse): response is AppUserSession {
  return "access_token" in response && response.account_type === "app_user";
}

export function isMFARequiredResponse(
  response: LoginResponse
): response is MFARequiredResponse {
  return "mfa_required" in response && response.mfa_required === true;
}

export function isMFASetupRequiredResponse(
  response: LoginResponse
): response is MFASetupRequiredResponse {
  return "mfa_setup_required" in response && response.mfa_setup_required === true;
}

export async function loginAppUser(
  identifier: string,
  password: string
): Promise<AppUserLoginResult> {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      account_type: "app_user",
      identifier,
      password,
    }),
  });

  if (isAppUserSession(response)) {
    return {
      kind: "authenticated",
      session: response,
    };
  }

  if (isMFARequiredResponse(response)) {
    return {
      kind: "mfa_required",
      challenge: response,
      identifier,
    };
  }

  if (isMFASetupRequiredResponse(response)) {
    return {
      kind: "mfa_setup_required",
      setup: response,
      identifier,
    };
  }

  throw new Error("Unexpected login response.");
}

export async function verifyAppUserMFA(payload: {
  challenge_token: string;
  code: string;
}): Promise<AppUserSession> {
  const response = await apiRequest<AppUserSession>("/auth/mfa/verify", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });

  if (!isAppUserSession(response)) {
    throw new Error("This login did not return an App User session.");
  }

  return response;
}


export async function confirmAppUserMFASetup(payload: {
  mfa_setup_token: string;
  code: string;
}): Promise<AppUserSession> {
  const response = await apiRequest<AppUserSession>("/auth/mfa/setup/confirm", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });

  if (!isAppUserSession(response)) {
    throw new Error("This MFA setup did not return an App User session.");
  }

  return response;
}

export async function changeAppUserMFAChallengeMethod(payload: {
  challenge_token: string;
  method: MFAMethod;
}): Promise<MFARequiredResponse> {
  return apiRequest<MFARequiredResponse>("/auth/mfa/challenge-method", {
    method: "PATCH",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function getCurrentAccount() {
  return apiRequest<CurrentAccount>("/auth/me");
}
export type MFAStatusResponse = {
  account_type: "admin" | "app_user";
  mfa_required: boolean;
  mfa_enabled: boolean;
  email_mfa_enabled: boolean;
  authenticator_mfa_enabled: boolean;
  preferred_mfa_method: MFAMethod | null;
  active_methods: MFAMethod[];
  can_disable_email_mfa: boolean;
  can_disable_authenticator_mfa: boolean;
};

export type MFASettingsChallengeResponse = {
  challenge_token: string;
  method: MFAMethod;
  expires_at: string;
  message: string;
  dev_email_code?: string | null;
};

export type MFABackupCodeStatusResponse = {
  account_type: "admin" | "app_user";
  backup_codes_available: boolean;
  available_backup_code_count: number;
};

export type MFABackupCodesRegenerateResponse = {
  account_type: "admin" | "app_user";
  backup_codes_available: boolean;
  available_backup_code_count: number;
  backup_codes: string[];
  message: string;
};

export function getMyMFAStatus() {
  return apiRequest<MFAStatusResponse>("/auth/me/mfa/status");
}

export function getMyMFABackupCodeStatus() {
  return apiRequest<MFABackupCodeStatusResponse>(
    "/auth/me/mfa/backup-codes/status"
  );
}

export function startMyAuthenticatorMFASetup() {
  return apiRequest<MFASetupRequiredResponse>(
    "/auth/me/mfa/authenticator/setup",
    {
      method: "POST",
    }
  );
}

export function confirmMyAuthenticatorMFASetup(payload: {
  mfa_setup_token: string;
  code: string;
}) {
  return apiRequest<MFAStatusResponse>(
    "/auth/me/mfa/authenticator/setup/confirm",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export function enableMyEmailMFA(payload: {
  challenge_token: string;
  code: string;
}) {
  return apiRequest<MFAStatusResponse>("/auth/me/mfa/email/enable", {
    method: "POST",
    body: JSON.stringify({
      action: "enable_email",
      challenge_token: payload.challenge_token,
      code: payload.code,
    }),
  });
}

export function applyMyMFASettingsAction(payload: {
  action:
    | "enable_email"
    | "disable_email"
    | "disable_authenticator"
    | "prefer_email"
    | "prefer_authenticator";
  challenge_token: string;
  code: string;
}) {
  return apiRequest<MFAStatusResponse>("/auth/me/mfa/settings-action", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateMyPreferredMFAMethod(method: MFAMethod) {
  return apiRequest<MFAStatusResponse>("/auth/me/mfa/preferred-method", {
    method: "PATCH",
    body: JSON.stringify({ method }),
  });
}

export function createMyMFASettingsChallenge(method: MFAMethod) {
  return apiRequest<MFASettingsChallengeResponse>(
    "/auth/me/mfa/settings-challenge",
    {
      method: "POST",
      body: JSON.stringify({ method }),
    }
  );
}

export function regenerateMyMFABackupCodes(payload: {
  challenge_token: string;
  code: string;
}) {
  return apiRequest<MFABackupCodesRegenerateResponse>(
    "/auth/me/mfa/backup-codes/regenerate",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}
export function disableMyEmailMFA(payload: {
  challenge_token: string;
  code: string;
}) {
  return apiRequest<MFAStatusResponse>("/auth/me/mfa/email/disable", {
    method: "PATCH",
    body: JSON.stringify({
      action: "disable_email",
      challenge_token: payload.challenge_token,
      code: payload.code,
    }),
  });
}

export function disableMyAuthenticatorMFA(payload: {
  challenge_token: string;
  code: string;
}) {
  return apiRequest<MFAStatusResponse>("/auth/me/mfa/authenticator/disable", {
    method: "PATCH",
    body: JSON.stringify({
      action: "disable_authenticator",
      challenge_token: payload.challenge_token,
      code: payload.code,
    }),
  });
}
