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
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import { useSelectedRouter } from "../state/SelectedRouterContext";
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

const sections: Array<{
  key: MoreSection;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    key: "plans",
    title: "Plans",
    subtitle: "Subscriptions and plan details",
    icon: "card-outline",
  },
  {
    key: "routers",
    title: "Routers",
    subtitle: "Router modes and capabilities",
    icon: "wifi-outline",
  },
  {
    key: "planRequest",
    title: "Plan Request",
    subtitle: "Request a plan manually",
    icon: "swap-horizontal-outline",
  },
  {
    key: "insights",
    title: "Insights",
    subtitle: "Predictions and recommendations",
    icon: "bulb-outline",
  },
  {
    key: "profile",
    title: "Profile",
    subtitle: "Account, theme, and logout",
    icon: "person-circle-outline",
  },
];

export function MoreScreen({ session, onLogout }: MoreScreenProps) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeSection, setActiveSection] = useState<MoreSection>("plans");
  const { selectedRouterId, setSelectedRouterId } = useSelectedRouter();

  if (activeSection === "plans") {
    return (
      <View style={styles.screen}>
        <MoreHeader
          activeSection={activeSection}
          onChangeSection={setActiveSection}
        />
        <SubscriptionsScreen />
      </View>
    );
  }

  if (activeSection === "routers") {
    return (
      <View style={styles.screen}>
        <MoreHeader
          activeSection={activeSection}
          onChangeSection={setActiveSection}
        />
        <RoutersScreen selectedRouterId={selectedRouterId} onSelectedRouterChange={setSelectedRouterId} />
      </View>
    );
  }

  if (activeSection === "planRequest") {
    return (
      <View style={styles.screen}>
        <MoreHeader
          activeSection={activeSection}
          onChangeSection={setActiveSection}
        />
        <ManualPlanChangeRequestScreen selectedRouterId={selectedRouterId} onSelectedRouterChange={setSelectedRouterId} />
      </View>
    );
  }

  if (activeSection === "insights") {
    return (
      <View style={styles.screen}>
        <MoreHeader
          activeSection={activeSection}
          onChangeSection={setActiveSection}
        />
        <InsightsScreen />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <MoreHeader
        activeSection={activeSection}
        onChangeSection={setActiveSection}
      />
      <ProfileScreen session={session} onLogout={onLogout} />
    </View>
  );
}

function MoreHeader({
  activeSection,
  onChangeSection,
}: {
  activeSection: MoreSection;
  onChangeSection: (section: MoreSection) => void;
}) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.headerWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionRail}
        style={{ backgroundColor: colors.background }}
      >
        {sections.map((section) => {
          const isActive = activeSection === section.key;

          return (
            <Pressable
              key={section.key}
              style={[
                styles.sectionButton,
                isActive && styles.sectionButtonActive,
              ]}
              onPress={() => onChangeSection(section.key)}
            >
              <Ionicons
                name={section.icon}
                size={18}
                color={colors.primary}
              />
              <View style={styles.sectionTextGroup}>
                <Text
                  style={[
                    styles.sectionTitle,
                    isActive && styles.sectionTitleActive,
                  ]}
                >
                  {section.title}
                </Text>
                <Text
                  style={[
                    styles.sectionSubtitle,
                    isActive && styles.sectionSubtitleActive,
                  ]}
                >
                  {section.subtitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
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
    headerWrap: {
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
    },
    sectionRail: {
      gap: 10,
      paddingHorizontal: 16,
    },
    sectionButton: {
      minWidth: 150,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    sectionButtonActive: {
      borderColor: colors.primary,
      backgroundColor:
        colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE",
    },
    sectionTextGroup: {
      flex: 1,
      gap: 2,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.text,
    },
    sectionTitleActive: {
      color: colors.primary,
    },
    sectionSubtitle: {
      fontSize: 11,
      color: colors.textSubtle,
    },
    sectionSubtitleActive: {
      color: colors.textMuted,
    },
  });
}
