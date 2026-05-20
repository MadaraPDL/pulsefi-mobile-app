import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { clearSession, getSession } from "./src/auth/session";
import { AppTabs } from "./src/navigation/AppTabs";
import type { RootStackParamList } from "./src/navigation/types";
import { LoginScreen } from "./src/screens/LoginScreen";
import type { AppUserSession } from "./src/types/appUser";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<AppUserSession | null>(null);

  useEffect(() => {
    async function restoreSession() {
      try {
        const savedSession = await getSession();
        setSession(savedSession);
      } finally {
        setIsBootstrapping(false);
      }
    }

    void restoreSession();
  }, []);

  async function handleLogout() {
    await clearSession();
    setSession(null);
  }

  if (isBootstrapping) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Opening PulseFi...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <Stack.Screen name="App">
              {() => <AppTabs session={session} onLogout={handleLogout} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Login">
              {() => <LoginScreen onLoginSuccess={setSession} />}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F6F8FB",
  },
  loadingText: {
    fontSize: 15,
    color: "#5D6B7A",
  },
});
