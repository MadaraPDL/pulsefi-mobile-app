import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { getCurrentAccount } from "./src/api/auth";
import { clearSession, getSession, saveSession } from "./src/auth/session";
import {
  addPulseFiNotificationResponseListener,
  getLastPulseFiNotificationResponseTarget,
  registerForPulseFiPushNotifications,
  type PulseFiPushNavigationTarget,
} from "./src/notifications/pushNotifications";
import { AppTabs } from "./src/navigation/AppTabs";
import type { RootStackParamList } from "./src/navigation/types";
import { LoginScreen } from "./src/screens/LoginScreen";
import { PulseFiThemeProvider, usePulseFiTheme } from "./src/theme/ThemeProvider";
import type { AppUserSession, CurrentAccount } from "./src/types/appUser";

const Stack = createNativeStackNavigator<RootStackParamList>();

function buildRootAppRouteParams(target: PulseFiPushNavigationTarget) {
  if (target.screen === "More") {
    return {
      screen: "More" as const,
      params: target.params,
    };
  }

  return {
    screen: target.screen,
  };
}

function mergeSessionWithCurrentAccount(
  session: AppUserSession,
  current: CurrentAccount
): AppUserSession {
  return {
    ...session,
    account_type: "app_user",
    account_id: current.account_id,
    full_name: current.full_name,
    email: current.email,
    username: current.username,
    role: current.role,
  };
}

function PulseFiAppShell() {
  const { colors, mode, navigationTheme } = usePulseFiTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingNotificationTargetRef = useRef<PulseFiPushNavigationTarget | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<AppUserSession | null>(null);

  useEffect(() => {
    async function restoreSession() {
      try {
        const savedSession = await getSession();

        if (!savedSession) {
          return;
        }

        const currentAccount = await getCurrentAccount();

        if (currentAccount.account_type !== "app_user") {
          await clearSession();
          return;
        }

        if (currentAccount.status !== "active") {
          await clearSession();
          return;
        }

        const refreshedSession = mergeSessionWithCurrentAccount(
          savedSession,
          currentAccount
        );

        await saveSession(refreshedSession);
        setSession(refreshedSession);
        void registerForPulseFiPushNotifications();
      } catch {
        await clearSession();
        setSession(null);
      } finally {
        setIsBootstrapping(false);
      }
    }

    void restoreSession();
  }, []);

  function navigateToPushTarget(target: PulseFiPushNavigationTarget) {
    if (!session || !navigationRef.isReady()) {
      pendingNotificationTargetRef.current = target;
      return;
    }

    navigationRef.navigate("App", buildRootAppRouteParams(target));
  }

  function flushPendingNotificationTarget() {
    const target = pendingNotificationTargetRef.current;

    if (!target || !session || !navigationRef.isReady()) {
      return;
    }

    pendingNotificationTargetRef.current = null;
    navigationRef.navigate("App", buildRootAppRouteParams(target));
  }

  useEffect(() => {
    if (!session) {
      return;
    }

    const subscription = addPulseFiNotificationResponseListener(
      navigateToPushTarget
    );

    void getLastPulseFiNotificationResponseTarget().then((target) => {
      if (target) {
        navigateToPushTarget(target);
      }
    });

    flushPendingNotificationTarget();

    return () => {
      subscription.remove();
    };
  }, [session]);

  async function handleLogout() {
    await clearSession();
    setSession(null);
  }

  if (isBootstrapping) {
    return (
      <SafeAreaProvider>
        <View
          style={[
            styles.loadingContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Opening PulseFi...
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={flushPendingNotificationTarget}
      >
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <Stack.Screen name="App">
              {() => <AppTabs session={session} onLogout={handleLogout} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Login">
              {() => (
                <LoginScreen
                  onLoginSuccess={(nextSession) => {
                    setSession(nextSession);
                    void registerForPulseFiPushNotifications();
                  }}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <PulseFiThemeProvider>
      <PulseFiAppShell />
    </PulseFiThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
});
