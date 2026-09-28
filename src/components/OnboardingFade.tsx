import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme";

type OnboardingFadeProps = {
  edge: "top" | "bottom";
  height: number;
};

const TOP_OPACITIES = [1, 0.62, 0.3, 0.1];
const BOTTOM_OPACITIES = [0.1, 0.3, 0.62, 1];

export function OnboardingFade({ edge, height }: OnboardingFadeProps) {
  const theme = useTheme();
  const opacities = edge === "top" ? TOP_OPACITIES : BOTTOM_OPACITIES;
  return (
    <View
      pointerEvents="none"
      style={[styles.container, { height }, edge === "top" ? styles.top : styles.bottom]}
    >
      {opacities.map((opacity, index) => (
        <View key={index} style={[styles.segment, { backgroundColor: theme.bg, opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  segment: {
    flex: 1,
  },
});
