import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getCurrentAccount } from "../api/auth";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";
import type { AppUserSession, CurrentAccount } from "../types/appUser";

type ProfileScreenProps = {
  session: AppUserSession;
  onLogout: () => Promise<void>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not verified";
  }

  return new Date(value).toLocaleString();
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

export function ProfileScreen({ session, onLogout }: ProfileScreenProps) {
  const { colors, mode, toggleMode } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [account, setAccount] = useState<CurrentAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const currentAccount = await getCurrentAccount();

      if (currentAccount.account_type !== "app_user") {
        throw new Error("This mobile app is only for App User accounts.");
      }

      setAccount(currentAccount);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load profile."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const displayName = account?.full_name ?? session.full_name;
  const email = account?.email ?? session.email;
  const username = account?.username ?? session.username;
  const status = account?.status ?? "unknown";

  if (isLoading && !account) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadProfile(true)}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>Profile</Text>
      <Text style={[styles.title, { color: colors.text }]}>My account</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Live account details from the PulseFi backend.
      </Text>

      {errorMessage ? (
        <View style={[styles.errorCard, { backgroundColor: colors.dangerBackground, borderColor: colors.dangerBorder }]}>
          <Text style={[styles.errorTitle, { color: colors.dangerText }]}>Could not refresh profile</Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.themeRow}>
          <View style={styles.themeTextGroup}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Theme</Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {mode === "dark" ? "Dark mode" : "Light mode"}
            </Text>
          </View>

          <Pressable
            style={styles.themeButton}
            onPress={() => void toggleMode()}
          >
            <Text style={styles.themeButtonText}>
              Switch to {mode === "dark" ? "Light" : "Dark"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Name</Text>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{displayName}</Text>

        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Email</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>{email}</Text>

        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Username</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>{username ?? "Not set"}</Text>

        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Status</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>{status}</Text>

        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Email verified</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          {formatDateTime(account?.email_verified_at ?? null)}
        </Text>

        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>MFA enabled</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          {formatBoolean(account?.mfa_enabled ?? false)}
        </Text>

        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>MFA required</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          {formatBoolean(account?.mfa_required ?? false)}
        </Text>

        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>MFA method</Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          {account?.mfa_enabled
            ? account.preferred_mfa_method ?? "Unknown"
            : "Not enabled"}
        </Text>

        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Account ID</Text>
        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          {account?.account_id ?? session.account_id}
        </Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => void onLogout()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

export default ProfileScreen;

function createStyles(colors: ReturnType<typeof usePulseFiTheme>["colors"]) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 24,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      gap: 16,
      padding: 20,
      backgroundColor: colors.background,
    },
    eyebrow: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    title: {
      fontSize: 28,
      fontWeight: "900",
      color: colors.text,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
    },
    card: {
      borderRadius: 22,
      padding: 18,
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeRow: {
      gap: 14,
    },
    themeTextGroup: {
      gap: 4,
    },
    themeButton: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      paddingVertical: 12,
      backgroundColor: colors.primary,
    },
    themeButtonText: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.buttonText,
    },
    errorCard: {
      borderRadius: 18,
      padding: 16,
      gap: 6,
      backgroundColor: colors.dangerBackground,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    errorTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.dangerText,
    },
    errorText: {
      fontSize: 14,
      color: colors.dangerText,
    },
    cardLabel: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: "800",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: colors.text,
    },
    cardText: {
      fontSize: 15,
      color: colors.textMuted,
    },
    smallText: {
      fontSize: 12,
      color: colors.textSubtle,
    },
    mutedText: {
      fontSize: 14,
      color: colors.textSubtle,
      textAlign: "center",
    },
    logoutButton: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      paddingVertical: 14,
      backgroundColor: colors.primaryStrong,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.buttonText,
    },
  });
}
