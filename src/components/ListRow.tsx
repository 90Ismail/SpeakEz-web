import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { pressed as pressedOpacity, textStyle, useTheme } from "../theme";
import { Caps } from "./Caps";

export function formatDuration(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.floor(durationSec % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type ListRowEyebrowTone = "ink2" | "ink3" | "accent" | "danger";

export type ListRowProps = {
  leading?: ReactNode;
  eyebrow?: string;
  eyebrowTone?: ListRowEyebrowTone;
  /** Small state glyph rendered before the eyebrow (12px, same color as the eyebrow). */
  eyebrowIcon?: keyof typeof Ionicons.glyphMap;
  title: string;
  titleNumberOfLines?: number;
  /** Overrides the default serif row title (textStyle.rowTitleSerif). */
  titleStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  contentGap?: number;
  rowGap?: number;
  paddingVertical?: number;
  paddingLeft?: number;
  paddingRight?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared list row from the design: hairline-separated, serif title (the
 * student's words), caps eyebrow, optional leading/trailing controls. Pressed
 * rows tint rather than dim.
 */
export function ListRow({
  leading,
  eyebrow,
  eyebrowTone = "ink3",
  eyebrowIcon,
  title,
  titleNumberOfLines = 2,
  titleStyle,
  children,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  contentGap = 3,
  rowGap = 16,
  paddingVertical = 16,
  paddingLeft = 24,
  paddingRight = 12,
  style,
}: ListRowProps) {
  const theme = useTheme();
  const eyebrowColors: Record<ListRowEyebrowTone, string> = {
    ink2: theme.ink2,
    ink3: theme.ink3,
    accent: theme.accentText,
    danger: theme.danger,
  };
  const body = (
    <>
      {leading}
      <View style={[styles.content, { gap: contentGap }]}>
        {eyebrow ? (
          <View style={styles.eyebrowRow}>
            {eyebrowIcon ? <Ionicons name={eyebrowIcon} size={12} color={eyebrowColors[eyebrowTone]} /> : null}
            <Caps numberOfLines={1} tone={eyebrowTone} style={styles.eyebrow}>
              {eyebrow}
            </Caps>
          </View>
        ) : null}
        <Text numberOfLines={titleNumberOfLines} style={[styles.title, { color: theme.ink }, titleStyle]}>
          {title}
        </Text>
        {children}
      </View>
      {trailing}
    </>
  );
  const base: StyleProp<ViewStyle> = [
    styles.row,
    {
      paddingTop: paddingVertical,
      paddingBottom: paddingVertical,
      paddingLeft,
      paddingRight,
      gap: rowGap,
      borderBottomColor: theme.line,
    },
    style,
  ];
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={base}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [base, pressed && { backgroundColor: theme.tint }]}
    >
      {body}
    </Pressable>
  );
}

type ListRowMoreProps = {
  accessibilityLabel: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Trailing "more options" ellipsis for list rows: 44 hit target, ink2 glyph. */
export function ListRowMore({ accessibilityLabel, onPress, style }: ListRowMoreProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.more, { opacity: pressed ? pressedOpacity.dim : 1 }, style]}
    >
      <Ionicons name="ellipsis-horizontal" size={18} color={theme.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  eyebrow: {
    ...textStyle.caps,
  },
  title: {
    ...textStyle.rowTitleSerif,
  },
  more: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
