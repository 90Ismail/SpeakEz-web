import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { fonts, radius, type, useTheme } from "../theme";

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
        {
          backgroundColor: selected ? theme.accentSoft : theme.surfaceClear,
          borderColor: selected ? theme.accentSoft : theme.line,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {selected && <Ionicons name="checkmark" size={14} color={theme.accentText} />}
      <Text style={[styles.label, { color: selected ? theme.accentText : theme.ink2 }]}>{label}</Text>
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: fonts.sansSemibold,
    fontSize: type.support },
});
