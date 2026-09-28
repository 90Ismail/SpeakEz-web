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

type RecordProcessingStageProps = {
  onDone: () => void;
  topInset: number;
};

export function RecordProcessingStage({ onDone, topInset }: RecordProcessingStageProps) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;

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

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

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

      <View accessibilityLabel="Processing, please wait" style={[styles.steps, { borderTopColor: theme.line }]}>
        {STEPS.map((label, index) => {
          const done = index < activeStep;
          const active = index === activeStep;
          return (
            <View key={label} style={[styles.step, { borderBottomColor: theme.line }]}>
              <View style={styles.state}>
                {done ? (
                  <View style={[styles.doneDisc, { backgroundColor: theme.accent }]}>
                    <Ionicons name="checkmark" size={13} color={theme.onAccent} />
                  </View>
                ) : null}
                {active ? (
                  <Animated.View
                    style={[
                      styles.activeRing,
                      {
                        borderColor: theme.line,
                        borderTopColor: theme.accent,
                        borderRightColor: theme.accent,
                        transform: [{ rotate }],
                      },
                    ]}
                  />
                ) : null}
                {!done && !active ? (
                  <View style={[styles.pendingRing, { borderColor: theme.controlLine }]} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, { color: done || active ? theme.ink : theme.ink3 }]}>
                {label}
              </Text>
            </View>
          );
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
