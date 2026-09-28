import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { space, textStyle, useTheme } from "../theme";
import { IconButton } from "./IconButton";

export type TopBarLeading = {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

type TopBarProps = {
  /** Centered title. Omit for screens whose title lives in the display heading below. */
  title?: string;
  /** Leading tint button. Pass `null` for no leading control (the trailing control still aligns right). */
  leading?: TopBarLeading | null;
  trailing?: ReactNode;
};

/**
 * Shell / Top Bar from the design: 52 high, gutter padding, 44 tint leading
 * button, sans semibold centered title, optional trailing control. Every
 * secondary screen uses this so the shell reads the same everywhere.
 */
export function TopBar({ title, leading, trailing }: TopBarProps) {
  const theme = useTheme();
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {leading ? (
          <IconButton
            icon={leading.icon ?? "arrow-back"}
            variant="tint"
            size={44}
            iconSize={19}
            onPress={leading.onPress}
            accessibilityLabel={leading.label}
          />
        ) : null}
      </View>
      {title ? (
        <Text numberOfLines={1} style={[styles.title, { color: theme.ink }]}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.side, styles.trailing]}>{trailing ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.gutter,
  },
  side: {
    minWidth: 44,
    height: 44,
    justifyContent: "center",
  },
  trailing: {
    alignItems: "flex-end",
  },
  title: {
    position: "absolute",
    left: space.gutter + 52,
    right: space.gutter + 52,
    textAlign: "center",
    ...textStyle.barTitle,
  },
});
