import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { pressed as pressedOpacity, radius, textStyle, useTheme } from "../theme";

type ReactionButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function ReactionButton({ label, selected, onPress }: ReactionButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.base,
        selected
          ? {
              backgroundColor: theme.accentSoft,
              borderColor: theme.accent,
              borderWidth: 1.5,
              opacity: pressed ? pressedOpacity.soft : 1,
            }
          : {
              backgroundColor: pressed ? theme.tint : theme.surfaceClear,
              borderColor: theme.line,
              borderWidth: 1,
            },
      ]}
    >
      {selected && <Ionicons name="checkmark" size={14} color={theme.accentText} />}
      <Text style={[styles.label, { color: selected ? theme.accentText : theme.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  label: { ...textStyle.chipSerif },
});
