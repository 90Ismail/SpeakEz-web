import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, fontWeight, type, useTheme } from "../theme";
import { IconButton } from "./IconButton";

type OnboardingTopBarProps = {
  onBack: () => void;
  title?: string;
  right?: ReactNode;
};

export function OnboardingTopBar({ onBack, title, right }: OnboardingTopBarProps) {
  const theme = useTheme();
  return (
    <View style={styles.bar}>
      <IconButton
        icon="arrow-back"
        variant="tint"
        iconSize={19}
        onPress={onBack}
        accessibilityLabel="Go back"
      />
      {title !== undefined ? (
        <>
          <Text numberOfLines={1} style={[styles.title, { color: theme.ink }]}>
            {title}
          </Text>
          <View style={styles.trailingSpacer} />
        </>
      ) : (
        <View style={styles.trailing}>{right}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.semibold,
  },
  trailingSpacer: {
    width: 44,
  },
  trailing: {
    flex: 1,
    alignItems: "flex-end",
  },
});
