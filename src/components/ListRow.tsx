import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fonts, fontWeight, type, useTheme } from "../theme";
import { Caps } from "./Caps";

export function formatDuration(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.floor(durationSec % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type ListRowProps = {
  leading?: ReactNode;
  eyebrow?: string;
  eyebrowTone?: "ink2" | "ink3" | "accent" | "danger";
  title: string;
  titleNumberOfLines?: number;
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

export function ListRow({
  leading,
  eyebrow,
  eyebrowTone = "ink3",
  title,
  titleNumberOfLines = 2,
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
  const body = (
    <>
      {leading}
      <View style={[styles.content, { gap: contentGap }]}>
        {eyebrow ? (
          <Caps numberOfLines={1} tone={eyebrowTone} style={styles.eyebrow}>
            {eyebrow}
          </Caps>
        ) : null}
        <Text numberOfLines={titleNumberOfLines} style={[styles.title, { color: theme.ink }]}>
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
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {body}
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
  eyebrow: {
    letterSpacing: 1.3,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: type.heading,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.7,
  },
});
