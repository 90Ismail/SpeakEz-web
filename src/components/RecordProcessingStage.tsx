import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { space, textStyle, useTheme } from "../theme";
import { Waveform } from "./Waveform";

const STEPS = [
  "Voice anonymized",
  "Transcribed",
  "Removing names and identifying details",
  "Suggesting a title",
];

const STEP_MS = 620;

type StepState = "done" | "active" | "pending";

type RecordProcessingStageProps = {
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
  const pop = useRef(new Animated.Value(state === "done" ? 1 : 0)).current;

  useEffect(() => {
    if (state !== "done") return;
    pop.setValue(0.4);
    Animated.spring(pop, {
      toValue: 1,
      friction: 4.5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [state, pop]);

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
      </View>
      <Text style={[styles.stepLabel, { color: state === "pending" ? theme.ink3 : theme.ink }]}>
        {label}
      </Text>
    </View>
  );
}

export function RecordProcessingStage({ onDone, topInset }: RecordProcessingStageProps) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((step) => (step >= STEPS.length ? step : step + 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeStep < STEPS.length) return undefined;
    const id = setTimeout(onDone, 350);
    return () => clearTimeout(id);
  }, [activeStep, onDone]);

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

  useEffect(() => {
    const loop = Animated.loop(
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
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const loop = Animated.loop(
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
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

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

      <View accessibilityLabel="Processing, please wait" style={[styles.steps, { borderTopColor: theme.line }]}>
        {STEPS.map((label, index) => {
          const state: StepState =
            index < activeStep ? "done" : index === activeStep ? "active" : "pending";
          return <StepRow key={label} label={label} state={state} spin={spin} pulse={pulse} />;
        })}
      </View>
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
  stepLabel: {
    flex: 1,
    ...textStyle.body,
  },
});
