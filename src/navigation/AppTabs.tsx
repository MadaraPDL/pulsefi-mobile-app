import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertsScreen } from "../screens/AlertsScreen";
import { DevicesScreen } from "../screens/DevicesScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { UsageScreen } from "../screens/UsageScreen";
import type { AppUserSession } from "../types/appUser";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

type AppTabsProps = {
  session: AppUserSession;
  onLogout: () => Promise<void>;
};

export function AppTabs({ session, onLogout }: AppTabsProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: {
          fontWeight: "900",
        },
        tabBarActiveTintColor: "#00A7D8",
        tabBarInactiveTintColor: "#6B7888",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          borderTopColor: "#E3EAF2",
          height: 58 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "800",
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Usage" component={UsageScreen} />
      <Tab.Screen name="Devices" component={DevicesScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile">
        {() => <ProfileScreen session={session} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
