import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { radius, space, textStyle, useTheme } from "../theme";
import { Waveform } from "./Waveform";
import { RecordControls, type RecordPrimaryMode } from "./RecordControls";

type RecordCaptureStageProps = {
  landmarkName: string;
  elapsedSec: number;
  maxSec: number;
  isRecording: boolean;
  hasRecording: boolean;
  permissionDenied: boolean;
  primaryMode: RecordPrimaryMode;
  onPrimaryPressIn: () => void;
  onPrimaryPressOut: () => void;
  onPrimaryPress: () => void;
  onRestart: () => void;
  onDone: () => void;
  primaryLabel: string;
};

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function RecordCaptureStage({
  landmarkName,
  elapsedSec,
  maxSec,
  isRecording,
  hasRecording,
  permissionDenied,
  primaryMode,
  onPrimaryPressIn,
  onPrimaryPressOut,
  onPrimaryPress,
  onRestart,
  onDone,
  primaryLabel,
}: RecordCaptureStageProps) {
  const theme = useTheme();
  const chipLabel = isRecording
    ? `Recording near ${landmarkName}`
    : hasRecording
      ? `Recorded at ${landmarkName}`
      : `Near ${landmarkName}`;
  const status = permissionDenied
    ? "Microphone access is off — enable it in Settings"
    : isRecording
      ? `Recording  ·  ${clock(maxSec - elapsedSec)} left`
      : hasRecording
        ? "Recorded  ·  ready to place"
        : "Hold the button or tap to start  ·  3:00 max";
  const progress = isRecording || hasRecording ? Math.min(1, elapsedSec / maxSec) : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.chip, { borderColor: theme.controlLine }]}>
        <Ionicons name="location-outline" size={14} color={theme.ink2} />
        <Text style={[styles.chipLabel, { color: theme.ink2 }]} numberOfLines={1}>
          {chipLabel}
        </Text>
      </View>

      <Text style={[styles.prompt, { color: theme.ink }]}>Say the thing you haven&apos;t said out loud.</Text>

      <View style={styles.live}>
        <Waveform progress={progress} seed={7} barCount={40} height={72} style={styles.waveform} />
        <View style={styles.timer}>
          <Text style={[styles.elapsed, { color: theme.ink }]}>{clock(elapsedSec)}</Text>
          <Text style={[styles.status, { color: permissionDenied ? theme.danger : theme.ink3 }]}>{status}</Text>
        </View>
      </View>

      <RecordControls
        primaryMode={primaryMode}
        onPrimaryPressIn={onPrimaryPressIn}
        onPrimaryPressOut={onPrimaryPressOut}
        onPrimaryPress={onPrimaryPress}
        onRestart={onRestart}
        onDone={onDone}
        restartDisabled={!isRecording && !hasRecording}
        doneDisabled={!hasRecording}
        primaryDisabled={permissionDenied}
        primaryLabel={primaryLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: space.lg,
    paddingHorizontal: space.gutter,
    paddingBottom: 40,
  },
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    gap: 6,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    ...textStyle.support,
  },
  prompt: {
    paddingTop: space.lg,
    ...textStyle.displaySerif,
  },
  live: {
    flex: 1,
    justifyContent: "center",
    gap: 20,
  },
  waveform: {
    width: "100%",
  },
  timer: {
    alignItems: "flex-start",
    gap: space.xs,
  },
  elapsed: {
    ...textStyle.hero,
    fontVariant: ["tabular-nums"],
  },
  status: {
    ...textStyle.support,
  },
});
