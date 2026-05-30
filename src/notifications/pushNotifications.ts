import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";

import { registerPushToken } from "../api/pushTokens";

type ExpoConstantsWithEas = typeof Constants & {
  easConfig?: {
    projectId?: string;
  };
};

type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unknown";

type PulseFiNotificationData = Record<string, unknown>;

export type PulseFiPushNavigationTarget =
  | {
      screen: "Alerts";
    }
  | {
      screen: "More";
      params: {
        section: "insights" | "planRequest";
      };
    };

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

export function getPulseFiNotificationNavigationTarget(
  data: PulseFiNotificationData | null | undefined
): PulseFiPushNavigationTarget | null {
  if (!data) {
    return null;
  }

  if (data.screen === "Alerts") {
    return {
      screen: "Alerts",
    };
  }

  if (data.screen === "More" && data.section === "insights") {
    return {
      screen: "More",
      params: {
        section: "insights",
      },
    };
  }

  if (data.screen === "More" && data.section === "planRequest") {
    return {
      screen: "More",
      params: {
        section: "planRequest",
      },
    };
  }

  return null;
}

export function addPulseFiNotificationResponseListener(
  onTarget: (target: PulseFiPushNavigationTarget) => void
) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const target = getPulseFiNotificationNavigationTarget(
      response.notification.request.content.data
    );

    if (target) {
      onTarget(target);
    }
  });
}

export async function getLastPulseFiNotificationResponseTarget() {
  const response = await Notifications.getLastNotificationResponseAsync();

  return getPulseFiNotificationNavigationTarget(
    response?.notification.request.content.data
  );
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
      Alert.alert("PulseFi Push Debug", `Permission not granted: ${finalStatus}`); console.log("PulseFi notifications permission not granted:", finalStatus);
      return;
    }

    const projectId = getExpoProjectId();

    if (!projectId) {
      Alert.alert("PulseFi Push Debug", "Missing EAS project ID."); console.log("PulseFi notifications skipped: missing EAS project ID.");
      return;
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResult.data;

    if (!expoPushToken) {
      Alert.alert("PulseFi Push Debug", "No Expo push token returned."); console.log("PulseFi notifications skipped: no Expo push token returned.");
      return;
    }

    await registerPushToken({
      expo_push_token: expoPushToken,
      platform: getPlatformName(),
      device_id: `${Platform.OS}-${projectId}`,
      permission_status: finalStatus,
    });

    hasRegisteredThisSession = true; Alert.alert("PulseFi Push Debug", "Push token registered successfully.");
  } catch (error) {
    Alert.alert("PulseFi Push Debug", `Registration failed: ${String(error)}`); console.log("PulseFi push registration failed:", error);
  }
}
