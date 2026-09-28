import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme";

type OnboardingDotsProps = {
  active: number;
  total?: number;
};

export function OnboardingDots({ active, total = 3 }: OnboardingDotsProps) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${active + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: active + 1 }}
      style={styles.row}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === active
              ? { width: 18, backgroundColor: theme.ink }
              : { width: 6, backgroundColor: theme.controlLine },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
