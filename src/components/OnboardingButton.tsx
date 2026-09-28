import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { pressed, radius, space, textStyle, useTheme } from "../theme";

type OnboardingButtonProps = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** Primary pill from the design: ink fill, 52 high, sans bold label in surface. */
export function OnboardingButton({
  label,
  onPress,
  icon,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: OnboardingButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed: isPressed }) => [
        styles.primary,
        { backgroundColor: theme.ink, opacity: disabled ? 0.35 : isPressed ? pressed.soft : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={17} color={theme.surface} /> : null}
      <Text style={[styles.primaryLabel, { color: theme.surface }]}>{label}</Text>
    </Pressable>
  );
}

type OnboardingTextButtonProps = {
  label: string;
  onPress: () => void;
  tone?: "ink" | "ink2" | "accent";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function OnboardingTextButton({
  label,
  onPress,
  tone = "ink2",
  accessibilityLabel,
  accessibilityHint,
  style,
}: OnboardingTextButtonProps) {
  const theme = useTheme();
  const colors = { ink: theme.ink, ink2: theme.ink2, accent: theme.accentText };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={({ pressed: isPressed }) => [styles.textButton, { opacity: isPressed ? pressed.dim : 1 }, style]}
    >
      <Text style={[styles.textButtonLabel, { color: colors[tone] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 52,
    paddingHorizontal: space.gutter,
    borderRadius: radius.pill,
    width: "100%",
  },
  primaryLabel: {
    ...textStyle.bodyStrong,
  },
  textButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  textButtonLabel: {
    ...textStyle.bodyStrong,
  },
});
