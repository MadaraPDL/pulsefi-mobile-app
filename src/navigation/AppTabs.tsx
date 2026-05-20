import type { ComponentProps } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertsScreen } from "../screens/AlertsScreen";
import { DevicesScreen } from "../screens/DevicesScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { InsightsScreen } from "../screens/InsightsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { SubscriptionsScreen } from "../screens/SubscriptionsScreen";
import { UsageScreen } from "../screens/UsageScreen";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type { AppUserSession } from "../types/appUser";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

type TabIconName = ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<
  keyof AppTabParamList,
  { focused: TabIconName; unfocused: TabIconName }
> = {
  Home: {
    focused: "home",
    unfocused: "home-outline",
  },
  Subscriptions: {
    focused: "card",
    unfocused: "card-outline",
  },
  Usage: {
    focused: "stats-chart",
    unfocused: "stats-chart-outline",
  },
  Devices: {
    focused: "hardware-chip",
    unfocused: "hardware-chip-outline",
  },
  Alerts: {
    focused: "notifications",
    unfocused: "notifications-outline",
  },
  Insights: {
    focused: "bulb",
    unfocused: "bulb-outline",
  },
  Profile: {
    focused: "person-circle",
    unfocused: "person-circle-outline",
  },
};

type AppTabsProps = {
  session: AppUserSession;
  onLogout: () => Promise<void>;
};

export function AppTabs({ session, onLogout }: AppTabsProps) {
  const insets = useSafeAreaInsets();
  const { colors } = usePulseFiTheme();
  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "900",
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarIcon: ({ color, focused, size }) => {
          const iconSet = tabIcons[route.name];

          return (
            <Ionicons
              name={focused ? iconSet.focused : iconSet.unfocused}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Subscriptions"
        component={SubscriptionsScreen}
        options={{
          tabBarLabel: "Plans",
          title: "Subscriptions",
        }}
      />
      <Tab.Screen name="Usage" component={UsageScreen} />
      <Tab.Screen name="Devices" component={DevicesScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Profile">
        {() => <ProfileScreen session={session} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
