import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { radius, useTheme } from "../theme";

export function ProfileButton() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/profile")}
      accessibilityRole="button"
      accessibilityLabel="Your profile"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.glass,
          borderColor: theme.glassStroke,
          shadowColor: theme.glassShadow,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.accentSoft, borderColor: theme.accentLine }]}>
        <Ionicons name="person" size={16} color={theme.accentText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
