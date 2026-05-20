import { useCallback, useEffect, useState } from "react";
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
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.mutedText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadProfile(true)}
        />
      }
    >
      <Text style={styles.eyebrow}>Profile</Text>
      <Text style={styles.title}>My account</Text>
      <Text style={styles.subtitle}>
        Live account details from the PulseFi backend.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not refresh profile</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Name</Text>
        <Text style={styles.cardTitle}>{displayName}</Text>

        <Text style={styles.cardLabel}>Email</Text>
        <Text style={styles.cardText}>{email}</Text>

        <Text style={styles.cardLabel}>Username</Text>
        <Text style={styles.cardText}>{username ?? "Not set"}</Text>

        <Text style={styles.cardLabel}>Status</Text>
        <Text style={styles.cardText}>{status}</Text>

        <Text style={styles.cardLabel}>Email verified</Text>
        <Text style={styles.cardText}>
          {formatDateTime(account?.email_verified_at ?? null)}
        </Text>

        <Text style={styles.cardLabel}>MFA enabled</Text>
        <Text style={styles.cardText}>
          {formatBoolean(account?.mfa_enabled ?? false)}
        </Text>

        <Text style={styles.cardLabel}>MFA required</Text>
        <Text style={styles.cardText}>
          {formatBoolean(account?.mfa_required ?? false)}
        </Text>

        <Text style={styles.cardLabel}>MFA method</Text>
        <Text style={styles.cardText}>
          {account?.mfa_enabled ? account.preferred_mfa_method ?? "Unknown" : "Not enabled"}
        </Text>

        <Text style={styles.cardLabel}>Account ID</Text>
        <Text style={styles.smallText}>{account?.account_id ?? session.account_id}</Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => void onLogout()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

export default ProfileScreen;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#F6F8FB",
  },
  container: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
    backgroundColor: "#F6F8FB",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    color: "#00A7D8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#102033",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5D6B7A",
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
  },
  errorCard: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
    backgroundColor: "#FFF3F0",
    borderWidth: 1,
    borderColor: "#FFD1C7",
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8A2E1B",
  },
  errorText: {
    fontSize: 14,
    color: "#8A2E1B",
  },
  cardLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
    color: "#617083",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#102033",
  },
  cardText: {
    fontSize: 15,
    color: "#33465B",
  },
  smallText: {
    fontSize: 12,
    color: "#6B7888",
  },
  mutedText: {
    fontSize: 14,
    color: "#6B7888",
    textAlign: "center",
  },
  logoutButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: "#102033",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});

