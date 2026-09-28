import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, space, type, useTheme } from "../theme";
import { Waveform } from "./Waveform";

const STEPS = [
  "Uploading your voice note",
  "Sending it to the GPU worker",
  "Getting your draft ready",
];

export type RecordProcessingPhase = "uploading" | "queued" | "error";

type RecordProcessingStageProps = {
  phase: RecordProcessingPhase;
  errorMessage?: string;
  onRetry: () => void;
  onDone: () => void;
  topInset: number;
};

export function RecordProcessingStage({
  phase,
  errorMessage,
  onRetry,
  onDone,
  topInset,
}: RecordProcessingStageProps) {
  const theme = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== "queued") return undefined;
    const id = setTimeout(onDone, 350);
    return () => clearTimeout(id);
  }, [onDone, phase]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const activeStep = phase === "queued" ? 2 : 0;

  return (
    <View style={[styles.root, { paddingTop: topInset + 56 }]}>
      <View style={styles.motif}>
        <Waveform progress={0.45} seed={11} barCount={10} height={52} style={styles.motifWave} />
        <Ionicons name="arrow-forward" size={16} color={theme.ink3} />
        <View style={styles.lines}>
          <View style={[styles.line, { width: 160, backgroundColor: theme.ink }]} />
          <View style={[styles.line, { width: 138, backgroundColor: theme.ink }]} />
          <View style={[styles.line, { width: 150, backgroundColor: theme.waveMuted }]} />
          <View style={[styles.line, { width: 96, backgroundColor: theme.waveMuted }]} />
        </View>
      </View>

      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.ink }]}>Turning your voice into a story.</Text>
        <Text style={[styles.sub, { color: theme.ink2 }]}>About twenty seconds.</Text>
      </View>

      <View accessibilityLabel={phase === "error" ? "Upload failed" : "Uploading your voice note"}>
        {STEPS.map((label, index) => {
          const done = phase === "queued" && index < 2;
          const active = phase !== "error" && index === activeStep;
          return (
            <View key={label} style={styles.step}>
              <View style={styles.state}>
                {done ? (
                  <View style={[styles.doneCircle, { backgroundColor: theme.ink }]}>
                    <Ionicons name="checkmark" size={12} color={theme.surface} />
                  </View>
                ) : null}
                {active ? (
                  <Animated.View
                    style={[
                      styles.spinner,
                      {
                        borderColor: theme.line,
                        borderTopColor: theme.accent,
                        transform: [{ rotate }],
                      },
                    ]}
                  />
                ) : null}
                {phase === "error" && index === 0 ? (
                  <View style={[styles.errorCircle, { backgroundColor: theme.dangerSoft }]}>
                    <Ionicons name="alert" size={13} color={theme.danger} />
                  </View>
                ) : null}
                {!done && !active ? (
                  <View style={[styles.pendingCircle, { borderColor: theme.line }]} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, { color: done || active ? theme.ink : theme.ink3 }]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {phase === "error" ? (
        <View style={styles.errorBlock}>
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {errorMessage ?? "We couldn't send your voice note."}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry voice note upload"
            style={({ pressed }) => [
              styles.retry,
              { borderColor: theme.controlLine, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={15} color={theme.ink} />
            <Text style={[styles.retryLabel, { color: theme.ink }]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: space.xl,
    paddingHorizontal: space.gutter,
    paddingBottom: space.xxl,
  },
  motif: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  motifWave: {
    width: 120,
  },
  lines: {
    gap: space.sm,
  },
  line: {
    height: 4,
    borderRadius: 2,
  },
  heading: {
    gap: space.sm,
  },
  title: {
    fontFamily: fonts.sansBold,
    fontSize: type.display,
    lineHeight: type.display * 1.1,
    letterSpacing: -0.8 },
  sub: {
    fontFamily: fonts.sans,
    fontSize: type.body },
  step: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  state: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  doneCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
  },
  pendingCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  errorCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.body },
  errorBlock: {
    gap: space.md,
    paddingTop: space.sm,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    lineHeight: type.body * 1.35,
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  retryLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: type.support,
  },
});
