import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { space, textStyle, useReducedMotion, useTheme } from "../theme";
import { Waveform } from "./Waveform";

const STEPS = [
  "Uploading your voice note",
  "Sending it to the GPU worker",
  "Getting your draft ready",
];

export type RecordProcessingPhase = "uploading" | "queued" | "error";

type StepState = "done" | "active" | "pending" | "error";

type RecordProcessingStageProps = {
  phase: RecordProcessingPhase;
  errorMessage?: string;
  onRetry: () => void;
  onDone: () => void;
  topInset: number;
};

type StepRowProps = {
  label: string;
  state: StepState;
  spin: Animated.Value;
  pulse: Animated.Value;
};

function StepRow({ label, state, spin, pulse }: StepRowProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(state === "done" ? 1 : 0)).current;

  useEffect(() => {
    if (state !== "done") return;
    if (reduced) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0.4);
    Animated.spring(pop, {
      toValue: 1,
      friction: 4.5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [state, pop, reduced]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const washOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

  return (
    <View style={[styles.step, { borderBottomColor: theme.line }]}>
      {state === "active" ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.activeWash, { backgroundColor: theme.tint, opacity: washOpacity }]}
        />
      ) : null}
      <View style={styles.state}>
        {state === "done" ? (
          <Animated.View
            style={[styles.doneDisc, { backgroundColor: theme.accent, transform: [{ scale: pop }] }]}
          >
            <Ionicons name="checkmark" size={13} color={theme.onAccent} />
          </Animated.View>
        ) : null}
        {state === "active" ? (
          <Animated.View
            style={[
              styles.activeRing,
              {
                borderColor: theme.line,
                borderTopColor: theme.accent,
                borderRightColor: theme.accent,
                opacity: ringOpacity,
                transform: [{ rotate }, { scale: ringScale }],
              },
            ]}
          />
        ) : null}
        {state === "pending" ? (
          <View style={[styles.pendingRing, { borderColor: theme.controlLine }]} />
        ) : null}
        {state === "error" ? (
          <View style={[styles.errorCircle, { backgroundColor: theme.dangerSoft }]}>
            <Ionicons name="alert" size={13} color={theme.danger} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.stepLabel, { color: state === "pending" ? theme.ink3 : theme.ink }]}>
        {label}
      </Text>
    </View>
  );
}

export function RecordProcessingStage({
  phase,
  errorMessage,
  onRetry,
  onDone,
  topInset,
}: RecordProcessingStageProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== "queued") return undefined;
    const id = setTimeout(onDone, 350);
    return () => clearTimeout(id);
  }, [onDone, phase]);

  useEffect(() => {
    if (reduced) {
      spin.setValue(0);
      pulse.setValue(0);
      shimmer.setValue(0.5);
      return undefined;
    }
    const loops = [
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(shimmer, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reduced, spin, pulse, shimmer]);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const activeStep = phase === "queued" ? STEPS.length : 0;

  return (
    <View style={[styles.root, { paddingTop: topInset + 56 }]}>
      <View style={styles.motif}>
        <Waveform progress={0.45} seed={11} barCount={10} height={52} style={styles.motifWave} />
        <Ionicons name="arrow-forward" size={16} color={theme.ink3} />
        <View style={styles.lines}>
          <View style={[styles.line, { width: 160, backgroundColor: theme.ink }]} />
          <View style={[styles.line, { width: 138, backgroundColor: theme.ink }]} />
          <Animated.View
            style={[styles.line, { width: 150, backgroundColor: theme.waveMuted, opacity: shimmerOpacity }]}
          />
          <Animated.View
            style={[styles.line, { width: 96, backgroundColor: theme.waveMuted, opacity: shimmerOpacity }]}
          />
        </View>
      </View>

      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.ink }]}>Turning your voice into a story.</Text>
        <Text style={[styles.sub, { color: theme.ink2 }]}>About twenty seconds.</Text>
      </View>

      <View
        accessibilityLabel={phase === "error" ? "Upload failed" : "Processing, please wait"}
        style={[styles.steps, { borderTopColor: theme.line }]}
      >
        {STEPS.map((label, index) => {
          const state: StepState =
            phase === "error" && index === 0
              ? "error"
              : index < activeStep
                ? "done"
                : index === activeStep
                  ? "active"
                  : "pending";
          return <StepRow key={label} label={label} state={state} spin={spin} pulse={pulse} />;
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
    ...textStyle.displaySans,
  },
  sub: {
    ...textStyle.body,
  },
  steps: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  step: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activeWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  state: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  doneDisc: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  activeRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  pendingRing: {
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
    ...textStyle.body,
  },
  errorBlock: {
    gap: space.md,
    paddingTop: space.sm,
  },
  errorText: {
    ...textStyle.body,
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
    ...textStyle.supportStrong,
  },
});
