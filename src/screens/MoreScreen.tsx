import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { InsightsScreen } from "./InsightsScreen";
import { ManualPlanChangeRequestScreen } from "./ManualPlanChangeRequestScreen";
import { ProfileScreen } from "./ProfileScreen";
import { RoutersScreen } from "./RoutersScreen";
import { SubscriptionsScreen } from "./SubscriptionsScreen";
import { useSelectedRouter } from "../state/SelectedRouterContext";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type { AppUserSession } from "../types/appUser";

type MoreSection =
  | "plans"
  | "routers"
  | "planRequest"
  | "insights"
  | "profile";

type MoreScreenProps = {
  session: AppUserSession;
  onLogout: () => Promise<void>;
};

type MoreMenuItem = {
  key: MoreSection;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const internetItems: MoreMenuItem[] = [
  {
    key: "routers",
    title: "My routers",
    subtitle: "Choose which router this app is showing.",
    icon: "wifi-outline",
  },
  {
    key: "plans",
    title: "My package",
    subtitle: "View your active package and plan limits.",
    icon: "card-outline",
  },
  {
    key: "planRequest",
    title: "Request a plan change",
    subtitle: "Ask your ISP to upgrade or change your package.",
    icon: "swap-horizontal-outline",
  },
  {
    key: "insights",
    title: "Predictions & recommendations",
    subtitle: "See usage forecasts and PulseFi suggestions.",
    icon: "bulb-outline",
  },
];

const accountItems: MoreMenuItem[] = [
  {
    key: "profile",
    title: "Profile & security",
    subtitle: "Manage your account, theme, MFA, and logout.",
    icon: "person-circle-outline",
  },
];

const sectionTitles: Record<MoreSection, string> = {
  routers: "My routers",
  plans: "My package",
  planRequest: "Request a plan change",
  insights: "Predictions & recommendations",
  profile: "Profile & security",
};

const sectionSubtitles: Record<MoreSection, string> = {
  routers: "Select the router/service you want PulseFi to show.",
  plans: "Review your current package and subscription details.",
  planRequest: "Send a package change request to your ISP.",
  insights: "Check predictions and recommendations for your account.",
  profile: "Update account settings and security options.",
};

export function MoreScreen({ session, onLogout }: MoreScreenProps) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeSection, setActiveSection] = useState<MoreSection | null>(null);
  const { selectedRouterId, setSelectedRouterId } = useSelectedRouter();

  if (!activeSection) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.menuContent}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>More</Text>
          <Text style={styles.title}>Account and services</Text>
          <Text style={styles.subtitle}>
            Manage your router, package, recommendations, and account settings.
          </Text>
        </View>

        <MoreGroup
          title="Your internet"
          subtitle="Router, usage package, and plan actions."
          items={internetItems}
          onSelect={setActiveSection}
        />

        <MoreGroup
          title="Account & security"
          subtitle="Profile, theme, MFA, and sign out."
          items={accountItems}
          onSelect={setActiveSection}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionHeader
        title={sectionTitles[activeSection]}
        subtitle={sectionSubtitles[activeSection]}
        onBack={() => setActiveSection(null)}
      />

      {activeSection === "plans" ? <SubscriptionsScreen /> : null}

      {activeSection === "routers" ? (
        <RoutersScreen
          selectedRouterId={selectedRouterId}
          onSelectedRouterChange={setSelectedRouterId}
        />
      ) : null}

      {activeSection === "planRequest" ? (
        <ManualPlanChangeRequestScreen
          selectedRouterId={selectedRouterId}
          onSelectedRouterChange={setSelectedRouterId}
        />
      ) : null}

      {activeSection === "insights" ? <InsightsScreen /> : null}

      {activeSection === "profile" ? (
        <ProfileScreen session={session} onLogout={onLogout} />
      ) : null}
    </View>
  );
}

function MoreGroup({
  title,
  subtitle,
  items,
  onSelect,
}: {
  title: string;
  subtitle: string;
  items: MoreMenuItem[];
  onSelect: (section: MoreSection) => void;
}) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.groupCard}>
      <Text style={styles.groupTitle}>{title}</Text>
      <Text style={styles.groupSubtitle}>{subtitle}</Text>

      <View style={styles.menuList}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.menuItem,
              { opacity: pressed ? 0.72 : 1 },
            ]}
            onPress={() => onSelect(item.key)}
          >
            <View style={styles.iconBubble}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSubtle}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.sectionHeader}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={18} color={colors.primary} />
        <Text style={styles.backButtonText}>More</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default MoreScreen;

function createStyles(colors: ReturnType<typeof usePulseFiTheme>["colors"]) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    menuContent: {
      padding: 20,
      gap: 16,
      backgroundColor: colors.background,
    },
    heroCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      gap: 8,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    title: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    groupCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 16,
      gap: 12,
    },
    groupTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: colors.text,
    },
    groupSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
    },
    menuList: {
      gap: 10,
    },
    menuItem: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      padding: 14,
    },
    iconBubble: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE",
    },
    menuText: {
      flex: 1,
      gap: 3,
    },
    menuTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
    },
    menuSubtitle: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    sectionHeader: {
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingRight: 10,
    },
    backButtonText: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.primary,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
    },
  });
}
