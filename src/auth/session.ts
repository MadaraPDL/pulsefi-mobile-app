import * as SecureStore from "expo-secure-store";
import type { AppUserSession } from "../types/appUser";

const SESSION_KEY = "pulsefi_app_user_session";

export async function saveSession(session: AppUserSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<AppUserSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AppUserSession;
  } catch {
    await clearSession();
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
