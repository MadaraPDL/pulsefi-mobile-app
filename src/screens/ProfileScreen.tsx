import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  confirmMyAuthenticatorMFASetup,
  createMyMFASettingsChallenge,
  disableMyAuthenticatorMFA,
  disableMyEmailMFA,
  enableMyEmailMFA,
  getCurrentAccount,
  getMyMFABackupCodeStatus,
  getMyMFAStatus,
  regenerateMyMFABackupCodes,
  startMyAuthenticatorMFASetup,
  updateMyPreferredMFAMethod,
} from "../api/auth";
import type {
  MFABackupCodeStatusResponse,
  MFAMethod,
  MFASetupRequiredResponse,
  MFAStatusResponse,
} from "../api/auth";
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
  tone?: "neutral" | "success" | "warning" | "danger";
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
        : tone === "danger"
          ? {
              backgroundColor: colors.dangerBackground,
              borderColor: colors.dangerBorder,
              color: colors.dangerText,
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
  const [mfaStatus, setMfaStatus] = useState<MFAStatusResponse | null>(null);
  const [backupStatus, setBackupStatus] =
    useState<MFABackupCodeStatusResponse | null>(null);

  const [authSetup, setAuthSetup] =
    useState<MFASetupRequiredResponse | null>(null);
  const [authSetupCode, setAuthSetupCode] = useState("");
  const [emailEnableChallengeToken, setEmailEnableChallengeToken] =
    useState<string | null>(null);
  const [emailEnableCode, setEmailEnableCode] = useState("");

  const [backupChallengeMethod, setBackupChallengeMethod] =
    useState<MFAMethod>("authenticator");
  const [backupChallengeToken, setBackupChallengeToken] = useState<
    string | null
  >(null);
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableTarget, setDisableTarget] = useState<
    "email" | "authenticator" | null
  >(null);
  const [disableChallengeToken, setDisableChallengeToken] = useState<
    string | null
  >(null);
  const [disableCodeInput, setDisableCodeInput] = useState("");
  const [disableVerificationMethod, setDisableVerificationMethod] =
    useState<MFAMethod | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const [currentAccount, status, backup] = await Promise.all([
        getCurrentAccount(),
        getMyMFAStatus(),
        getMyMFABackupCodeStatus(),
      ]);

      if (currentAccount.account_type !== "app_user") {
        throw new Error("This mobile app is only for App User accounts.");
      }

      setAccount(currentAccount);
      setMfaStatus(status);
      setBackupStatus(backup);

      if (
        status.authenticator_mfa_enabled &&
        backupChallengeMethod !== "authenticator"
      ) {
        setBackupChallengeMethod("authenticator");
      } else if (
        !status.authenticator_mfa_enabled &&
        status.email_mfa_enabled &&
        backupChallengeMethod !== "email"
      ) {
        setBackupChallengeMethod("email");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load profile."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [backupChallengeMethod]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const displayName = account?.full_name ?? session.full_name;
  const email = account?.email ?? session.email;
  const username = account?.username ?? session.username;
  const status = account?.status ?? "unknown";
  const emailVerified = Boolean(account?.email_verified_at);

  const authenticatorEnabled =
    mfaStatus?.authenticator_mfa_enabled ?? account?.mfa_enabled ?? false;
  const emailMfaEnabled = mfaStatus?.email_mfa_enabled ?? false;
  const mfaEnabled = mfaStatus?.mfa_enabled ?? account?.mfa_enabled ?? false;
  const mfaRequired = mfaStatus?.mfa_required ?? account?.mfa_required ?? false;
  const preferredMethod =
    mfaStatus?.preferred_mfa_method ?? account?.preferred_mfa_method ?? null;

  async function refreshMfaPanels() {
    const [statusResult, backupResult] = await Promise.all([
      getMyMFAStatus(),
      getMyMFABackupCodeStatus(),
    ]);

    setMfaStatus(statusResult);
    setBackupStatus(backupResult);
  }

  async function handleStartAuthenticatorSetup() {
    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setBackupCodes([]);

      const setup = await startMyAuthenticatorMFASetup();

      setAuthSetup(setup);
      setAuthSetupCode("");
      setSuccessMessage("Scan the QR code with your authenticator app.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start authenticator setup."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleConfirmAuthenticatorSetup() {
    if (!authSetup) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const statusResult = await confirmMyAuthenticatorMFASetup({
        mfa_setup_token: authSetup.mfa_setup_token,
        code: authSetupCode.trim(),
      });

      setMfaStatus(statusResult);
      setAuthSetup(null);
      setAuthSetupCode("");
      setBackupChallengeMethod("authenticator");
      setSuccessMessage("Authenticator MFA is now enabled.");
      await refreshMfaPanels();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not confirm authenticator setup."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleStartEmailMFAEnable() {
    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setBackupCodes([]);

      const challenge = await createMyMFASettingsChallenge("email");

      setEmailEnableChallengeToken(challenge.challenge_token);
      setEmailEnableCode("");
      setSuccessMessage("Enter the verification code sent to your email.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not send email MFA verification code."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleConfirmEmailMFAEnable() {
    if (!emailEnableChallengeToken) {
      setErrorMessage("Start email verification before enabling email MFA.");
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const statusResult = await enableMyEmailMFA({
        challenge_token: emailEnableChallengeToken,
        code: emailEnableCode.trim(),
      });

      setMfaStatus(statusResult);
      setEmailEnableChallengeToken(null);
      setEmailEnableCode("");
      setSuccessMessage("Email MFA is now enabled.");
      await refreshMfaPanels();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not enable email MFA."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handlePreferMFA(method: MFAMethod) {
    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const statusResult = await updateMyPreferredMFAMethod(method);

      setMfaStatus(statusResult);
      setSuccessMessage(`Preferred MFA method set to ${formatLabel(method)}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update preferred MFA method."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleStartDisableMFA(
    methodToDisable: "email" | "authenticator",
    verificationMethod: MFAMethod
  ) {
    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setBackupCodes([]);

      const challenge = await createMyMFASettingsChallenge(verificationMethod);

      setDisableTarget(methodToDisable);
      setDisableVerificationMethod(verificationMethod);
      setDisableChallengeToken(challenge.challenge_token);
      setDisableCodeInput("");
      setSuccessMessage(
        `Enter the ${formatLabel(verificationMethod)} code to disable ${formatLabel(methodToDisable)} MFA.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start MFA disable verification."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleConfirmDisableMFA() {
    if (!disableTarget || !disableChallengeToken) {
      setErrorMessage("Start MFA verification before disabling a method.");
      return;
    }

    const target = disableTarget;

    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const statusResult =
        target === "email"
          ? await disableMyEmailMFA({
              challenge_token: disableChallengeToken,
              code: disableCodeInput.trim(),
            })
          : await disableMyAuthenticatorMFA({
              challenge_token: disableChallengeToken,
              code: disableCodeInput.trim(),
            });

      setMfaStatus(statusResult);
      setDisableTarget(null);
      setDisableVerificationMethod(null);
      setDisableChallengeToken(null);
      setDisableCodeInput("");
      setSuccessMessage(`${formatLabel(target)} MFA disabled.`);
      await refreshMfaPanels();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not disable MFA method."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateBackupChallenge(method: MFAMethod) {
    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setBackupCodes([]);
      setBackupChallengeMethod(method);

      const challenge = await createMyMFASettingsChallenge(method);

      setBackupChallengeToken(challenge.challenge_token);
      setBackupCodeInput("");
      setSuccessMessage(challenge.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create MFA verification challenge."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRegenerateBackupCodes() {
    if (!backupChallengeToken) {
      setErrorMessage("Start MFA verification before generating backup codes.");
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const result = await regenerateMyMFABackupCodes({
        challenge_token: backupChallengeToken,
        code: backupCodeInput.trim(),
      });

      setBackupCodes(result.backup_codes);
      setBackupStatus({
        account_type: result.account_type,
        backup_codes_available: result.backup_codes_available,
        available_backup_code_count: result.available_backup_code_count,
      });
      setBackupChallengeToken(null);
      setBackupCodeInput("");
      setSuccessMessage("Backup codes generated. Save them now.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not generate backup codes."
      );
    } finally {
      setIsWorking(false);
    }
  }

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
      <Text style={[styles.title, { color: colors.text }]}>
        Account settings
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Manage your account identity, security methods, backup codes, and theme.
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
            Action failed
          </Text>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {successMessage ? (
        <View
          style={[
            styles.successCard,
            {
              backgroundColor: colors.successBackground,
              borderColor: colors.successBorder,
            },
          ]}
        >
          <Text style={[styles.successTitle, { color: colors.successText }]}>
            Done
          </Text>
          <Text style={[styles.successText, { color: colors.successText }]}>
            {successMessage}
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
          MFA status
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
          label="Authenticator app"
          value={formatBoolean(authenticatorEnabled)}
          tone={authenticatorEnabled ? "success" : "warning"}
        />
        <StatusRow
          label="Email MFA"
          value={formatBoolean(emailMfaEnabled)}
          tone={emailMfaEnabled ? "success" : "neutral"}
        />
        <StatusRow
          label="Preferred method"
          value={formatLabel(preferredMethod)}
          tone={preferredMethod ? "success" : "neutral"}
        />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Authenticator app
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Use Google Authenticator, Microsoft Authenticator, 1Password, or any
          app that supports TOTP codes.
        </Text>

        {authenticatorEnabled ? (
          <StatusRow label="Status" value="Active" tone="success" />
        ) : (
          <PulseFiButton
            title="Set up authenticator app"
            variant="primary"
            fullWidth
            loading={isWorking}
            disabled={isWorking}
            onPress={() => void handleStartAuthenticatorSetup()}
          />
        )}

        {authSetup ? (
          <View
            style={[
              styles.setupBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Scan QR code
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Scan this QR code, then enter the 6-digit code from your
              authenticator app.
            </Text>

            <View style={styles.qrWrap}>
              <QRCode value={authSetup.authenticator_uri} size={190} />
            </View>

            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
              Manual setup key
            </Text>
            <Text style={[styles.secretText, { color: colors.text }]}>
              {authSetup.authenticator_secret}
            </Text>

            <TextInput
              value={authSetupCode}
              onChangeText={setAuthSetupCode}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="Enter authenticator code"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <View style={styles.buttonStack}>
              <PulseFiButton
                title="Confirm authenticator setup"
                variant="primary"
                fullWidth
                loading={isWorking}
                disabled={isWorking || authSetupCode.trim().length < 6}
                onPress={() => void handleConfirmAuthenticatorSetup()}
              />
              <PulseFiButton
                title="Cancel setup"
                variant="secondary"
                fullWidth
                disabled={isWorking}
                onPress={() => {
                  setAuthSetup(null);
                  setAuthSetupCode("");
                }}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Email MFA
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Email MFA sends a verification code to your account email when needed.
        </Text>

        {emailMfaEnabled ? (
          <StatusRow label="Status" value="Active" tone="success" />
        ) : emailEnableChallengeToken ? (
          <View
            style={[
              styles.setupBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Verify your email
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Enter the code sent to {email}. Email MFA will only be enabled
              after this verification succeeds.
            </Text>

            <TextInput
              value={emailEnableCode}
              onChangeText={setEmailEnableCode}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="Enter email code"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <View style={styles.buttonStack}>
              <PulseFiButton
                title="Confirm email MFA"
                variant="primary"
                fullWidth
                loading={isWorking}
                disabled={isWorking || emailEnableCode.trim().length < 6}
                onPress={() => void handleConfirmEmailMFAEnable()}
              />
              <PulseFiButton
                title="Resend code by email"
                variant="secondary"
                fullWidth
                disabled={isWorking}
                onPress={() => void handleStartEmailMFAEnable()}
              />
              <PulseFiButton
                title="Cancel email setup"
                variant="secondary"
                fullWidth
                disabled={isWorking}
                onPress={() => {
                  setEmailEnableChallengeToken(null);
                  setEmailEnableCode("");
                }}
              />
            </View>
          </View>
        ) : (
          <PulseFiButton
            title="Send code to enable email MFA"
            variant="primary"
            fullWidth
            loading={isWorking}
            disabled={isWorking}
            onPress={() => void handleStartEmailMFAEnable()}
          />
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Preferred MFA method
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Choose which active MFA method PulseFi should prefer during login and
          sensitive actions.
        </Text>

        <View style={styles.buttonStack}>
          <PulseFiButton
            title="Prefer authenticator"
            variant={preferredMethod === "authenticator" ? "primary" : "secondary"}
            fullWidth
            disabled={isWorking || !authenticatorEnabled}
            loading={isWorking && preferredMethod !== "authenticator"}
            onPress={() => void handlePreferMFA("authenticator")}
          />
          <PulseFiButton
            title="Prefer email"
            variant={preferredMethod === "email" ? "primary" : "secondary"}
            fullWidth
            disabled={isWorking || !emailMfaEnabled}
            loading={isWorking && preferredMethod !== "email"}
            onPress={() => void handlePreferMFA("email")}
          />
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Deactivate MFA method
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          You can disable one MFA method after verification. If MFA is required,
          PulseFi blocks disabling the last active method.
        </Text>

        <View style={styles.disableMethodGroup}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Disable email MFA
          </Text>
          <Text style={[styles.smallText, { color: colors.textSubtle }]}>
            Choose how to verify before disabling email MFA.
          </Text>

          <View style={styles.buttonStack}>
            <PulseFiButton
              title="Use authenticator code"
              variant="danger"
              fullWidth
              disabled={
                isWorking ||
                !emailMfaEnabled ||
                !authenticatorEnabled ||
                mfaStatus?.can_disable_email_mfa === false
              }
              onPress={() =>
                void handleStartDisableMFA("email", "authenticator")
              }
            />

            <PulseFiButton
              title="Verify with email code"
              variant="danger"
              fullWidth
              disabled={
                isWorking ||
                !emailMfaEnabled ||
                mfaStatus?.can_disable_email_mfa === false
              }
              onPress={() => void handleStartDisableMFA("email", "email")}
            />
          </View>
        </View>

        <View style={styles.disableMethodGroup}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Disable authenticator MFA
          </Text>
          <Text style={[styles.smallText, { color: colors.textSubtle }]}>
            Choose how to verify before disabling authenticator MFA.
          </Text>

          <View style={styles.buttonStack}>
            <PulseFiButton
              title="Use authenticator code"
              variant="danger"
              fullWidth
              disabled={
                isWorking ||
                !authenticatorEnabled ||
                mfaStatus?.can_disable_authenticator_mfa === false
              }
              onPress={() =>
                void handleStartDisableMFA("authenticator", "authenticator")
              }
            />

            <PulseFiButton
              title="Verify with email code"
              variant="danger"
              fullWidth
              disabled={
                isWorking ||
                !authenticatorEnabled ||
                !emailMfaEnabled ||
                mfaStatus?.can_disable_authenticator_mfa === false
              }
              onPress={() =>
                void handleStartDisableMFA("authenticator", "email")
              }
            />
          </View>
        </View>

        {disableChallengeToken ? (
          <View
            style={[
              styles.setupBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Confirm disable action
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              Enter your {formatLabel(disableVerificationMethod)} code to disable{" "}
              {formatLabel(disableTarget)} MFA.
            </Text>

            <TextInput
              value={disableCodeInput}
              onChangeText={setDisableCodeInput}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder={
                backupChallengeMethod === "authenticator"
                  ? "Enter authenticator code"
                  : "Enter email code"
              }
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <View style={styles.buttonStack}>
              <PulseFiButton
                title="Confirm disable"
                variant="danger"
                fullWidth
                loading={isWorking}
                disabled={isWorking || disableCodeInput.trim().length < 6}
                onPress={() => void handleConfirmDisableMFA()}
              />
              {disableTarget && disableVerificationMethod === "email" ? (
                <PulseFiButton
                  title="Resend code by email"
                  variant="secondary"
                  fullWidth
                  disabled={isWorking}
                  onPress={() =>
                    void handleStartDisableMFA(disableTarget, "email")
                  }
                />
              ) : null}
              <PulseFiButton
                title="Cancel"
                variant="secondary"
                fullWidth
                disabled={isWorking}
                onPress={() => {
                  setDisableTarget(null);
                  setDisableVerificationMethod(null);
                  setDisableChallengeToken(null);
                  setDisableCodeInput("");
                }}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          Backup codes
        </Text>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          Backup codes help you sign in if you lose access to your normal MFA
          method. They are shown only once.
        </Text>

        <StatusRow
          label="Available codes"
          value={`${backupStatus?.available_backup_code_count ?? 0}`}
          tone={
            backupStatus?.backup_codes_available ? "success" : "warning"
          }
        />

        <View style={styles.buttonStack}>
          {authenticatorEnabled ? (
            <PulseFiButton
              title="Use authenticator code"
              variant={
                backupChallengeMethod === "authenticator" &&
                backupChallengeToken
                  ? "primary"
                  : "secondary"
              }
              fullWidth
              disabled={isWorking}
              onPress={() => void handleCreateBackupChallenge("authenticator")}
            />
          ) : null}

          {emailMfaEnabled ? (
            <PulseFiButton
              title={
                backupChallengeMethod === "email" && backupChallengeToken
                  ? "Resend code by email"
                  : "Send email code"
              }
              variant={
                backupChallengeMethod === "email" && backupChallengeToken
                  ? "primary"
                  : "secondary"
              }
              fullWidth
              disabled={isWorking}
              onPress={() => void handleCreateBackupChallenge("email")}
            />
          ) : null}
        </View>

        {backupChallengeToken ? (
          <View
            style={[
              styles.setupBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {backupChallengeMethod === "authenticator"
                ? "Verify with authenticator"
                : "Verify with email code"}
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {backupChallengeMethod === "authenticator"
                ? "Enter the 6-digit code from your authenticator app to generate new backup codes."
                : "Enter the verification code sent to your email to generate new backup codes."}
            </Text>

            <TextInput
              value={backupCodeInput}
              onChangeText={setBackupCodeInput}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder={
                backupChallengeMethod === "authenticator"
                  ? "Enter authenticator code"
                  : "Enter email code"
              }
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <PulseFiButton
              title={
                backupChallengeMethod === "authenticator"
                  ? "Generate codes with authenticator"
                  : "Generate codes with email"
              }
              variant="primary"
              fullWidth
              loading={isWorking}
              disabled={isWorking || backupCodeInput.trim().length < 6}
              onPress={() => void handleRegenerateBackupCodes()}
            />
            {backupChallengeMethod === "email" ? (
              <PulseFiButton
                title="Resend code by email"
                variant="secondary"
                fullWidth
                disabled={isWorking}
                onPress={() => void handleCreateBackupChallenge("email")}
              />
            ) : null}
          </View>
        ) : null}

        {backupCodes.length ? (
          <View
            style={[
              styles.backupCodeBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.successBorder,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Save these backup codes now
            </Text>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              PulseFi will not show these exact codes again.
            </Text>

            {backupCodes.map((code) => (
              <Text
                key={code}
                style={[
                  styles.backupCode,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                {code}
              </Text>
            ))}
          </View>
        ) : null}
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
          Theme is stored locally on this phone and does not affect your
          backend account.
        </Text>

        <PulseFiButton
          title={`Switch to ${mode === "dark" ? "Light" : "Dark"}`}
          variant="primary"
          fullWidth
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
          Account details
        </Text>

        <StatusRow label="Name" value={displayName} />
        <StatusRow label="Username" value={username ?? "Not set"} />
        <StatusRow label="Email" value={email} />
        <StatusRow label="Role" value={formatLabel(account?.role ?? session.role)} />
        <StatusRow
          label="Email verified"
          value={formatDateTime(account?.email_verified_at ?? null)}
          tone={emailVerified ? "success" : "warning"}
        />
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
        disabled={isWorking}
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
      fontWeight: "900",
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
    setupBox: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      gap: 12,
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
    successCard: {
      borderRadius: 18,
      padding: 16,
      gap: 6,
      backgroundColor: colors.successBackground,
      borderWidth: 1,
      borderColor: colors.successBorder,
    },
    successTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.successText,
    },
    successText: {
      fontSize: 14,
      color: colors.successText,
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
    qrWrap: {
      alignSelf: "center",
      borderRadius: 18,
      padding: 14,
      backgroundColor: "#FFFFFF",
    },
    secretText: {
      borderWidth: 1,
      borderRadius: 14,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 1,
    },
    input: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: "900",
    },
    buttonStack: {
      gap: 10,
    },
    disableMethodGroup: {
      gap: 10,
      borderWidth: 1,
      borderRadius: 18,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: 14,
    },
    backupCodeBox: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      gap: 10,
    },
    backupCode: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 1,
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
