import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { radius, useTheme } from "../theme";

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
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={19} color={theme.ink} />
    </Pressable>
  );
}

export function MapControls() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: theme.glass,
          borderColor: theme.glassStroke,
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
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
