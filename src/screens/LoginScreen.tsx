import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { usePulseFiTheme } from "../theme/usePulseFiTheme";

import { loginAppUser } from "../api/auth";
import { saveSession } from "../auth/session";
import type { AppUserSession } from "../types/appUser";

type LoginScreenProps = {
  onLoginSuccess: (session: AppUserSession) => void;
};

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { colors } = usePulseFiTheme();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin() {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const session = await loginAppUser(identifier.trim(), password);
      await saveSession(session);
      onLoginSuccess(session);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login failed. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>PulseFi</Text>
        <Text style={[styles.title, { color: colors.text }]}>App User Login</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Sign in with your App User email or username.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Email or username</Text>
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
          <Text style={[styles.label, { color: colors.textMuted }]}>Password</Text>
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

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={[styles.errorText, { color: colors.dangerText }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={isSubmitting}
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={() => void handleLogin()}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F6F8FB",
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
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#102033",
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});
