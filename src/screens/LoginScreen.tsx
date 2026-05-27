import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PulseFiButton } from "../components/PulseFiButton";
import { usePulseFiTheme } from "../theme/usePulseFiTheme";

import {
  changeAppUserMFAChallengeMethod,
  confirmAppUserMFASetup,
  loginAppUser,
  requestAppUserPasswordReset,
  verifyAppUserMFA,
} from "../api/auth";
import type {
  MFAMethod,
  MFARequiredResponse,
  MFASetupRequiredResponse,
} from "../api/auth";
import { saveSession } from "../auth/session";
import type { AppUserSession } from "../types/appUser";

type LoginScreenProps = {
  onLoginSuccess: (session: AppUserSession) => void;
};

type LoginStep =
  | { kind: "credentials" }
  | { kind: "forgot_password" }
  | {
      kind: "mfa_required";
      challenge: MFARequiredResponse;
      identifier: string;
    }
  | {
      kind: "mfa_setup_required";
      setup: MFASetupRequiredResponse;
      identifier: string;
    };

function getMFAInstruction(method: MFAMethod) {
  if (method === "email") {
    return "Enter the code sent to your App User email.";
  }

  return "Enter the 6-digit code from your authenticator app.";
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { colors } = usePulseFiTheme();
  const [step, setStep] = useState<LoginStep>({ kind: "credentials" });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(
    null
  );
  const [mfaSuccessMessage, setMfaSuccessMessage] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [activeChallenge, setActiveChallenge] =
    useState<MFARequiredResponse | null>(null);
  const [isBackupCodeMode, setIsBackupCodeMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function finishLogin(session: AppUserSession) {
    await saveSession(session);
    onLoginSuccess(session);
  }

  async function handleLogin() {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setResetSuccessMessage(null);
      setMfaSuccessMessage(null);

      const result = await loginAppUser(identifier.trim(), password);

      if (result.kind === "authenticated") {
        await finishLogin(result.session);
        return;
      }

      if (result.kind === "mfa_required") {
        setActiveChallenge(result.challenge);
        setMfaCode("");
        setIsBackupCodeMode(false);
        setStep({
          kind: "mfa_required",
          challenge: result.challenge,
          identifier: result.identifier,
        });
        return;
      }

      setSetupCode("");
      setStep({
        kind: "mfa_setup_required",
        setup: result.setup,
        identifier: result.identifier,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login failed. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function openForgotPassword() {
    setResetIdentifier(identifier.trim());
    setResetSuccessMessage(null);
    setErrorMessage(null);
    setMfaSuccessMessage(null);
    setStep({ kind: "forgot_password" });
  }

  async function handleRequestPasswordReset() {
    const cleanedIdentifier = resetIdentifier.trim();

    if (!cleanedIdentifier) {
      setErrorMessage("Enter your email or username first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setResetSuccessMessage(null);

      const response = await requestAppUserPasswordReset(cleanedIdentifier);
      setResetSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not send password reset email."
      );
    } finally {
      setIsSubmitting(false);
    }
  }


  async function handleVerifyMFA() {
    if (!activeChallenge) {
      setErrorMessage("MFA challenge is missing. Please sign in again.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setMfaSuccessMessage(null);

      const session = await verifyAppUserMFA({
        challenge_token: activeChallenge.challenge_token,
        code: mfaCode.trim().replace(/\s/g, ""),
      });

      await finishLogin(session);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not verify MFA code."
      );
    } finally {
      setIsSubmitting(false);
    }
  }


  async function handleConfirmMFASetup() {
    if (step.kind !== "mfa_setup_required") {
      setErrorMessage("MFA setup is missing. Please sign in again.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const session = await confirmAppUserMFASetup({
        mfa_setup_token: step.setup.mfa_setup_token,
        code: setupCode.trim().replace(/\s/g, ""),
      });

      await finishLogin(session);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not confirm MFA setup."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleChangeMFAMethod(method: MFAMethod) {
    if (!activeChallenge) {
      setErrorMessage("MFA challenge is missing. Please sign in again.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setMfaSuccessMessage(null);

      const nextChallenge = await changeAppUserMFAChallengeMethod({
        challenge_token: activeChallenge.challenge_token,
        method,
      });

      setActiveChallenge(nextChallenge);
      setMfaCode("");
      setIsBackupCodeMode(false);
      setMfaSuccessMessage(
        method === "email"
          ? "A new verification code was sent to your email."
          : null
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not switch MFA method."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetToCredentials() {
    setStep({ kind: "credentials" });
    setActiveChallenge(null);
    setMfaCode("");
    setSetupCode("");
    setIsBackupCodeMode(false);
    setErrorMessage(null);
    setResetSuccessMessage(null);
    setMfaSuccessMessage(null);
  }

  const activeMethods = activeChallenge?.active_methods ?? [];
  const canUseEmail =
    activeChallenge?.method !== "email" && activeMethods.includes("email");
  const canUseAuthenticator =
    activeChallenge?.method !== "authenticator" &&
    activeMethods.includes("authenticator");
  const canResendEmailCode =
    activeChallenge?.method === "email" && !isBackupCodeMode;
  const canUseBackupCode = Boolean(activeChallenge?.backup_codes_available);
  const hasFallbackOptions =
    canUseEmail || canUseAuthenticator || canUseBackupCode || canResendEmailCode;

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.primary }]}>PulseFi</Text>

          {step.kind === "credentials" ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                App User Login
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Sign in with your App User email or username.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Email or username
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="user@example.com"
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={identifier}
                  onChangeText={setIdentifier}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Password
                </Text>
                <TextInput
                  placeholder="Your password"
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  secureTextEntry
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              {mfaSuccessMessage ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{mfaSuccessMessage}</Text>
                </View>
              ) : null}

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={[styles.errorText, { color: colors.dangerText }]}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              <PulseFiButton
                title="Sign in"
                disabled={isSubmitting}
                fullWidth
                loading={isSubmitting}
                onPress={() => void handleLogin()}
              />

              <PulseFiButton
                title="Forgot password?"
                variant="ghost"
                disabled={isSubmitting}
                fullWidth
                onPress={openForgotPassword}
              />
            </>
          ) : null}


          {step.kind === "forgot_password" ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                Reset password
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Enter your App User email or username. If the account exists, a
                secure reset link will be sent to the saved email address.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Email or username
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="user@example.com"
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={resetIdentifier}
                  onChangeText={setResetIdentifier}
                />
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={[styles.errorText, { color: colors.dangerText }]}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              {resetSuccessMessage ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{resetSuccessMessage}</Text>
                </View>
              ) : null}

              <PulseFiButton
                title={
                  resetSuccessMessage
                    ? "Send another reset email"
                    : "Send reset email"
                }
                disabled={isSubmitting || !resetIdentifier.trim()}
                fullWidth
                loading={isSubmitting}
                onPress={() => void handleRequestPasswordReset()}
              />

              <PulseFiButton
                title="Back to login"
                variant="secondary"
                disabled={isSubmitting}
                fullWidth
                onPress={resetToCredentials}
              />
            </>
          ) : null}

          {step.kind === "mfa_required" && activeChallenge ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                MFA Verification
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {isBackupCodeMode
                  ? "Enter one unused backup recovery code."
                  : getMFAInstruction(activeChallenge.method)}
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Verification code
                </Text>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType={isBackupCodeMode ? "default" : "number-pad"}
                  placeholder={isBackupCodeMode ? "Backup code" : "123456"}
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  style={[
                    styles.input,
                    styles.mfaInput,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={mfaCode}
                  onChangeText={setMfaCode}
                />
              </View>

              {hasFallbackOptions ? (
                <View style={styles.fallbackArea}>
                  <Text style={[styles.fallbackTitle, { color: colors.textMuted }]}>
                    Try another way
                  </Text>

                  <View style={styles.fallbackActions}>
                    {canResendEmailCode ? (
                      <PulseFiButton
                        title="Resend code by email"
                        variant="ghost"
                        compact
                        disabled={isSubmitting}
                        onPress={() => void handleChangeMFAMethod("email")}
                      />
                    ) : null}

                    {canUseEmail ? (
                      <PulseFiButton
                        title="Send code by email"
                        variant="ghost"
                        compact
                        disabled={isSubmitting}
                        onPress={() => void handleChangeMFAMethod("email")}
                      />
                    ) : null}

                    {canUseAuthenticator ? (
                      <PulseFiButton
                        title="Use authenticator"
                        variant="ghost"
                        compact
                        disabled={isSubmitting}
                        onPress={() =>
                          void handleChangeMFAMethod("authenticator")
                        }
                      />
                    ) : null}

                    {canUseBackupCode ? (
                      <PulseFiButton
                        title="Use backup code"
                        variant="ghost"
                        compact
                        disabled={isSubmitting}
                        onPress={() => {
                          setIsBackupCodeMode(true);
                          setMfaCode("");
                          setErrorMessage(null);
                        }}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={[styles.errorText, { color: colors.dangerText }]}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              <PulseFiButton
                title="Verify MFA"
                disabled={isSubmitting}
                fullWidth
                loading={isSubmitting}
                onPress={() => void handleVerifyMFA()}
              />

              <PulseFiButton
                title="Back to login"
                variant="secondary"
                disabled={isSubmitting}
                fullWidth
                onPress={resetToCredentials}
              />
            </>
          ) : null}

          {step.kind === "mfa_setup_required" ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                Set up MFA
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Open your authenticator app, choose Add account or Enter setup
                key, then use the PulseFi secret key below. After the app creates
                a 6-digit code, enter it here to finish login.
              </Text>

              <View
                style={[
                  styles.setupBox,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.setupLabel, { color: colors.textMuted }]}>
                  Secret key
                </Text>
                <Text selectable style={[styles.setupSecret, { color: colors.text }]}>
                  {step.setup.authenticator_secret.match(/.{1,4}/g)?.join(" ") ??
                    step.setup.authenticator_secret}
                </Text>
                <Text style={[styles.setupHint, { color: colors.textMuted }]}>
                  If the app asks for the type, choose Time-based or TOTP. Delete
                  any old PulseFi entry before adding this new one.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Authenticator code
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  placeholder="123456"
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  style={[
                    styles.input,
                    styles.mfaInput,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={setupCode}
                  onChangeText={setSetupCode}
                />
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={[styles.errorText, { color: colors.dangerText }]}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              <PulseFiButton
                title="Confirm MFA setup"
                disabled={isSubmitting}
                fullWidth
                loading={isSubmitting}
                onPress={() => void handleConfirmMFASetup()}
              />

              <PulseFiButton
                title="Back to login"
                variant="secondary"
                disabled={isSubmitting}
                fullWidth
                onPress={resetToCredentials}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F8FB",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 26,
    padding: 22,
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "900",
    color: "#00A7D8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#102033",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5D6B7A",
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#33465B",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8E2EC",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#102033",
    backgroundColor: "#FFFFFF",
  },
  mfaInput: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  setupBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  setupLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  setupSecret: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.2,
    lineHeight: 28,
  },
  setupHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  fallbackArea: {
    alignItems: "center",
    gap: 8,
  },
  fallbackTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  fallbackActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  errorBox: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FFF3F0",
    borderWidth: 1,
    borderColor: "#FFD1C7",
  },
  errorText: {
    color: "#8A2E1B",
    fontSize: 14,
    fontWeight: "700",
  },
  successBox: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#F0FFF7",
    borderWidth: 1,
    borderColor: "#BCE7CB",
  },
  successText: {
    color: "#145C2E",
    fontSize: 14,
    fontWeight: "700",
  },
});
