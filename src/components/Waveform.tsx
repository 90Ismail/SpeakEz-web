import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme";

type WaveformProps = {
  progress: number;
  seed: number;
  barCount?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

function barHeights(seed: number, count: number, maxHeight: number): number[] {
  const heights: number[] = [];
  let state = seed * 2654435761;
  for (let i = 0; i < count; i += 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const normalized = ((state >>> 8) % 1000) / 1000;
    const shape = 0.25 + 0.75 * Math.abs(Math.sin((i / count) * Math.PI));
    heights.push(Math.max(3, Math.round(maxHeight * normalized * shape)));
  }
  return heights;
}

export function Waveform({ progress, seed, barCount = 40, height = 28, style }: WaveformProps) {
  const theme = useTheme();
  const heights = barHeights(seed, barCount, height);
  const playedCount = Math.round(Math.min(Math.max(progress, 0), 1) * barCount);
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 2, height }, style]}>
      {heights.map((barHeight, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: barHeight,
            borderRadius: 1,
            backgroundColor: index < playedCount ? theme.accent : theme.waveMuted,
          }}
        />
      ))}
    </View>
  );
}
