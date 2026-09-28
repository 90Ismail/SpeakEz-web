import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, space, type, useTheme } from "../theme";

export type RecordPrimaryMode = "record" | "stop" | "continue";

type RecordControlsProps = {
  primaryMode: RecordPrimaryMode;
  onPrimaryPressIn: () => void;
  onPrimaryPressOut: () => void;
  onPrimaryPress: () => void;
  onRestart: () => void;
  onDone: () => void;
  restartDisabled: boolean;
  doneDisabled: boolean;
  primaryDisabled?: boolean;
  primaryLabel: string;
};

export function RecordControls({
  primaryMode,
  onPrimaryPressIn,
  onPrimaryPressOut,
  onPrimaryPress,
  onRestart,
  onDone,
  restartDisabled,
  doneDisabled,
  primaryDisabled = false,
  primaryLabel,
}: RecordControlsProps) {
  const theme = useTheme();
  const restartColor = restartDisabled ? theme.ink3 : theme.ink;
  const doneColor = doneDisabled ? theme.ink3 : theme.ink;
  const primaryHint =
    primaryMode === "continue"
      ? "Continues to choose where this note lives"
      : primaryMode === "stop"
        ? "Stops the recording"
        : "Hold to record, or tap to start and tap again to stop";
  return (
    <View style={styles.row}>
      <View style={styles.control}>
        <Pressable
          onPress={onRestart}
          disabled={restartDisabled}
          accessibilityRole="button"
          accessibilityLabel="Record again"
          accessibilityHint="Deletes the current recording and starts a new one"
          accessibilityState={{ disabled: restartDisabled }}
          style={({ pressed }) => [
            styles.smallButton,
            {
              borderColor: theme.controlLine,
              opacity: restartDisabled ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="refresh" size={18} color={restartColor} />
        </Pressable>
        <Text style={[styles.label, { color: theme.ink2 }]}>Restart</Text>
      </View>

      <View style={styles.control}>
        <Pressable
          onPressIn={onPrimaryPressIn}
          onPressOut={onPrimaryPressOut}
          onPress={onPrimaryPress}
          disabled={primaryDisabled}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          accessibilityHint={primaryHint}
          accessibilityState={{ disabled: primaryDisabled }}
          style={({ pressed }) => [
            styles.ring,
            { borderColor: theme.accent, opacity: primaryDisabled ? 0.4 : pressed ? 0.75 : 1 },
          ]}
        >
          {primaryMode === "stop" ? (
            <View style={[styles.stopSquare, { backgroundColor: theme.accent }]} />
          ) : null}
          {primaryMode === "record" ? (
            <View style={[styles.recordDot, { backgroundColor: theme.accent }]} />
          ) : null}
          {primaryMode === "continue" ? (
            <View style={[styles.recordDot, styles.continueDot, { backgroundColor: theme.accent }]}>
              <Ionicons name="arrow-forward" size={16} color={theme.onAccent} />
            </View>
          ) : null}
        </Pressable>
        <Text style={[styles.label, { color: theme.ink2 }]}>
          {primaryMode === "record" ? "Record" : primaryMode === "stop" ? "Stop" : "Continue"}
        </Text>
      </View>

      <View style={styles.control}>
        <Pressable
          onPress={onDone}
          disabled={doneDisabled}
          accessibilityRole="button"
          accessibilityLabel="Done recording"
          accessibilityHint="Continues to choose where this note lives"
          accessibilityState={{ disabled: doneDisabled }}
          style={({ pressed }) => [
            styles.smallButton,
            {
              borderColor: theme.controlLine,
              opacity: doneDisabled ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="checkmark" size={18} color={doneColor} />
        </Pressable>
        <Text style={[styles.label, { color: theme.ink2 }]}>Done</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  control: {
    alignItems: "center",
    gap: space.sm,
  },
  smallButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  recordDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  continueDot: {
    alignItems: "center",
    justifyContent: "center",
  },
  stopSquare: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: type.support },
});
