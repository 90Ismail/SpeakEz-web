import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, space, type, useTheme } from "../theme";
import { IconButton } from "./IconButton";

type RecordTopBarProps = {
  title: string;
  leadingIcon: keyof typeof Ionicons.glyphMap;
  leadingLabel: string;
  onLeadingPress?: () => void;
  trailing?: ReactNode;
};

export function RecordTopBar({ title, leadingIcon, leadingLabel, onLeadingPress, trailing }: RecordTopBarProps) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { paddingHorizontal: space.gutter }]}>
      <IconButton
        icon={leadingIcon}
        accessibilityLabel={leadingLabel}
        onPress={onLeadingPress}
        variant="tint"
        size={44}
        iconSize={19}
      />
      <Text numberOfLines={1} style={[styles.title, { color: theme.ink }]}>
        {title}
      </Text>
      <View style={styles.trailing}>{trailing ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    position: "absolute",
    left: space.gutter,
    right: space.gutter,
    textAlign: "center",
    fontFamily: fonts.sansSemibold,
    fontSize: type.body },
  trailing: {
    minWidth: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
