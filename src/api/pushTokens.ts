import { apiRequest } from "./client";

export type PushTokenRegisterPayload = {
  expo_push_token: string;
  platform: "android" | "ios" | "web" | "unknown";
  device_id?: string | null;
  permission_status: "granted" | "denied" | "undetermined" | "unknown";
};

export type PushTokenResponse = {
  id: string;
  expo_push_token: string;
  platform: string;
  device_id: string | null;
  permission_status: string;
  is_active: boolean;
  last_registered_at: string;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function registerPushToken(
  payload: PushTokenRegisterPayload
): Promise<PushTokenResponse> {
  return apiRequest<PushTokenResponse>("/app-user/me/push-tokens", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
