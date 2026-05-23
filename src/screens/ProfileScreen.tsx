import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getCurrentAccount } from "../api/auth";
import { PulseFiButton } from "../components/PulseFiButton";
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

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value.replaceAll("_", " ");
}

function StatusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const { colors } = usePulseFiTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const toneStyle =
    tone === "success"
      ? {
          backgroundColor: colors.successBackground,
          borderColor: colors.successBorder,
          color: colors.successText,
        }
      : tone === "warning"
        ? {
            backgroundColor:
              colors.mode === "dark"
                ? "rgba(255, 214, 107, 0.12)"
                : "#FFF7DF",
            borderColor:
              colors.mode === "dark"
                ? "rgba(255, 214, 107, 0.35)"
                : "#F0D48A",
            color: colors.mode === "dark" ? "#FFD66B" : "#7A5600",
          }
        : {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            color: colors.textMuted,
          };

  return (
    <View
      style={[
        styles.statusRow,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.statusLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.statusValue,
          {
            backgroundColor: toneStyle.backgroundColor,
            borderColor: toneStyle.borderColor,
            color: toneStyle.color,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
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
  const emailVerified = Boolean(account?.email_verified_at);
  const mfaEnabled = account?.mfa_enabled ?? false;
  const mfaRequired = account?.mfa_required ?? false;

  if (isLoading && !account) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textSubtle }]}>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadProfile(true)}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>Profile</Text>
      <Text style={[styles.title, { color: colors.text }]}>Account settings</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Check your account identity, security status, app theme, and session.
      </Text>

      {errorMessage ? (
        <View
          style={[
            styles.errorCard,
            {
              backgroundColor: colors.dangerBackground,
              borderColor: colors.dangerBorder,
            },
          ]}
        >
          <Text style={[styles.errorTitle, { color: colors.dangerText }]}>
            Could not refresh profile
          </Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Signed in as
        </Text>
        <Text style={[styles.heroName, { color: colors.text }]}>
          {displayName}
        </Text>
        <Text style={[styles.heroEmail, { color: colors.textMuted }]}>
          {email}
        </Text>

        <View style={styles.heroPillRow}>
          <Text
            style={[
              styles.heroPill,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                color: colors.textMuted,
              },
            ]}
          >
            {formatLabel(status)}
          </Text>
          <Text
            style={[
              styles.heroPill,
              {
                backgroundColor: emailVerified
                  ? colors.successBackground
                  : colors.dangerBackground,
                borderColor: emailVerified
                  ? colors.successBorder
                  : colors.dangerBorder,
                color: emailVerified ? colors.successText : colors.dangerText,
              },
            ]}
          >
            {emailVerified ? "Email verified" : "Email not verified"}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Appearance
        </Text>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {mode === "dark" ? "Dark mode" : "Light mode"}
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Theme is stored locally on this phone and does not affect your account.
        </Text>

        <PulseFiButton
          title={`Switch to ${mode === "dark" ? "Light" : "Dark"}`}
          variant="primary"
          compact
          onPress={() => void toggleMode()}
        />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Security
        </Text>

        <StatusRow
          label="MFA enabled"
          value={formatBoolean(mfaEnabled)}
          tone={mfaEnabled ? "success" : "warning"}
        />
        <StatusRow
          label="MFA required"
          value={formatBoolean(mfaRequired)}
          tone={mfaRequired ? "success" : "neutral"}
        />
        <StatusRow
          label="MFA method"
          value={mfaEnabled ? formatLabel(account?.preferred_mfa_method) : "Not enabled"}
          tone={mfaEnabled ? "success" : "warning"}
        />
        <StatusRow
          label="Email verified"
          value={formatDateTime(account?.email_verified_at ?? null)}
          tone={emailVerified ? "success" : "warning"}
        />

        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          MFA setup and verification are handled during login. This page confirms
          the live backend security state for the signed-in App User.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Account details
        </Text>

        <StatusRow label="Name" value={displayName} />
        <StatusRow label="Username" value={username ?? "Not set"} />
        <StatusRow label="Email" value={email} />
        <StatusRow label="Role" value={formatLabel(account?.role ?? session.role)} />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Demo note
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          This page proves that the mobile app is connected to the backend
          session, validates the App User role, and reads live security/profile
          state instead of mock data.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Technical details
        </Text>
        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          Account ID: {account?.account_id ?? session.account_id}
        </Text>
        <Text style={[styles.smallText, { color: colors.textSubtle }]}>
          Account type: {account?.account_type ?? session.account_type}
        </Text>
      </View>

      <PulseFiButton
        title="Log out"
        variant="danger"
        fullWidth
        onPress={() => void onLogout()}
      />
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
    heroCard: {
      borderRadius: 26,
      padding: 20,
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroName: {
      fontSize: 24,
      fontWeight: "950",
      color: colors.text,
    },
    heroEmail: {
      fontSize: 15,
      color: colors.textMuted,
    },
    heroPillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    heroPill: {
      borderRadius: 999,
      borderWidth: 1,
      overflow: "hidden",
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "capitalize",
    },
    card: {
      borderRadius: 22,
      padding: 18,
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
      lineHeight: 22,
      color: colors.textMuted,
    },
    statusRow: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 12,
      gap: 8,
    },
    statusLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    statusValue: {
      alignSelf: "flex-start",
      borderRadius: 999,
      borderWidth: 1,
      overflow: "hidden",
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      fontWeight: "900",
      textTransform: "capitalize",
    },
    smallText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSubtle,
    },
    mutedText: {
      fontSize: 14,
      color: colors.textSubtle,
      textAlign: "center",
    },
  });
}
