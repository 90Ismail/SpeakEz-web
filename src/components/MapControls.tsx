import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { pressed as pressedOpacity, radius, shadow, useTheme } from "../theme";

type ControlButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
};

function ControlButton({ icon, label, hint }: ControlButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.button, { opacity: pressed ? pressedOpacity.dim : 1 }]}
    >
      <Ionicons name={icon} size={19} color={theme.ink} />
    </Pressable>
  );
}

/** Map Controls pill from the design: surface fill, 1px line, control shadow (not glass). */
export function MapControls() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: theme.surface,
          borderColor: theme.line,
          shadowColor: theme.glassShadow,
        },
      ]}
    >
      <ControlButton icon="search" label="Search notes" hint="Not available in the demo" />
      <ControlButton icon="layers-outline" label="Map layers" hint="Not available in the demo" />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    ...shadow.control,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
