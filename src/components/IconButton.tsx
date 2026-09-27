import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme";

export type IconButtonVariant = "plain" | "tint" | "glass" | "solid";
export type IconButtonTone = "ink" | "accent" | "onAccent";

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: IconButtonVariant;
  tone?: IconButtonTone;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function IconButton({
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  variant = "plain",
  tone = "ink",
  size = 44,
  iconSize = 19,
  style,
  disabled,
}: IconButtonProps) {
  const theme = useTheme();
  const background: Record<IconButtonVariant, string> = {
    plain: theme.surfaceClear,
    tint: theme.tint,
    glass: theme.glass,
    solid: theme.accent,
  };
  const color: Record<IconButtonTone, string> = {
    ink: theme.ink,
    accent: theme.accentText,
    onAccent: theme.onAccent,
  };
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background[variant],
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        variant === "glass" && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassStroke },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={color[tone]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});
