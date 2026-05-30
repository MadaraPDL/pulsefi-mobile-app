import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPushToken } from "../api/pushTokens";

type ExpoConstantsWithEas = typeof Constants & {
  easConfig?: {
    projectId?: string;
  };
};

type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unknown";

let hasRegisteredThisSession = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getPlatformName(): "android" | "ios" | "web" | "unknown" {
  if (Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web") {
    return Platform.OS;
  }

  return "unknown";
}

function normalizePermissionStatus(status: string | null | undefined): PushPermissionStatus {
  if (status === "granted" || status === "denied" || status === "undetermined") {
    return status;
  }

  return "unknown";
}

function getExpoProjectId(): string | null {
  const constants = Constants as ExpoConstantsWithEas;

  return (
    constants.expoConfig?.extra?.eas?.projectId ??
    constants.easConfig?.projectId ??
    null
  );
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("pulsefi-alerts", {
    name: "PulseFi Alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#00D1FF",
  });
}

export async function registerForPulseFiPushNotifications() {
  if (hasRegisteredThisSession) {
    return;
  }

  try {
    await ensureAndroidNotificationChannel();

    const existingPermission = await Notifications.getPermissionsAsync();
    let finalStatus = normalizePermissionStatus(existingPermission.status);

    if (finalStatus !== "granted") {
      const requestedPermission = await Notifications.requestPermissionsAsync();
      finalStatus = normalizePermissionStatus(requestedPermission.status);
    }

    if (finalStatus !== "granted") {
      console.log("PulseFi notifications permission not granted:", finalStatus);
      return;
    }

    const projectId = getExpoProjectId();

    if (!projectId) {
      console.log("PulseFi notifications skipped: missing EAS project ID.");
      return;
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResult.data;

    if (!expoPushToken) {
      console.log("PulseFi notifications skipped: no Expo push token returned.");
      return;
    }

    await registerPushToken({
      expo_push_token: expoPushToken,
      platform: getPlatformName(),
      device_id: `${Platform.OS}-${projectId}`,
      permission_status: finalStatus,
    });

    hasRegisteredThisSession = true;
  } catch (error) {
    console.log("PulseFi push registration failed:", error);
  }
}
