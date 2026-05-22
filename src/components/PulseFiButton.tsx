import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { ReactNode } from "react";
import type {
  GestureResponderEvent,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";

import { usePulseFiTheme } from "../theme/usePulseFiTheme";

type PulseFiButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type PulseFiButtonProps = {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: PulseFiButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export function PulseFiButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  compact = false,
  fullWidth = false,
  leftIcon,
  style,
  textStyle,
  accessibilityLabel,
}: PulseFiButtonProps) {
  const { colors } = usePulseFiTheme();
  const palette = getVariantPalette(variant, colors);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        fullWidth ? styles.fullWidth : styles.fitContent,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity: isDisabled ? 0.55 : pressed ? 0.82 : 1,
          transform: [{ translateY: pressed && !isDisabled ? 1 : 0 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.textColor} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.text,
              compact && styles.compactText,
              { color: palette.textColor },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function getVariantPalette(
  variant: PulseFiButtonVariant,
  colors: ReturnType<typeof usePulseFiTheme>["colors"]
) {
  const primaryTint =
    colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE";
  const primaryText = colors.mode === "dark" ? colors.primary : "#0B5D7A";

  if (variant === "danger") {
    return {
      backgroundColor: colors.dangerBackground,
      borderColor: colors.dangerBorder,
      textColor: colors.dangerText,
    };
  }

  if (variant === "secondary") {
    return {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      textColor: colors.text,
    };
  }

  if (variant === "ghost") {
    return {
      backgroundColor: "transparent",
      borderColor: colors.border,
      textColor: primaryText,
    };
  }

  return {
    backgroundColor: primaryTint,
    borderColor: colors.primary,
    textColor: primaryText,
  };
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  regular: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  fitContent: {
    alignSelf: "flex-start",
  },
  text: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
    textAlign: "center",
  },
  compactText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
