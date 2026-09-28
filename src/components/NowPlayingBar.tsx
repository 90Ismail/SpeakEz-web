import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { fonts, fontWeight, radius, type, useTheme } from "../theme";

type NowPlayingBarProps = {
  title: string;
  timeLabel: string;
  progress: number;
  playing: boolean;
  onPress: () => void;
  onToggle?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function NowPlayingBar({ title, timeLabel, progress, playing, onPress, onToggle, style }: NowPlayingBarProps) {
  const theme = useTheme();
  const clamped = Math.min(Math.max(progress, 0), 1);
  const playedWidth: DimensionValue = `${Math.round(clamped * 100)}%`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Now playing: ${title}`}
      accessibilityHint="Opens the story"
      style={({ pressed }) => [
        styles.bar,
        {
          backgroundColor: theme.glassStrong,
          borderColor: theme.glassStroke,
          shadowColor: theme.glassShadow,
          opacity: pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause" : "Play"}
        style={[styles.toggle, { backgroundColor: theme.accent }]}
      >
        <Ionicons name={playing ? "pause" : "play"} size={17} color={theme.onAccent} />
      </Pressable>
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.ink }]}>
          {title}
        </Text>
        <View style={[styles.track, { backgroundColor: theme.waveMuted }]}>
          <View style={[styles.played, { backgroundColor: theme.accent, width: playedWidth }]} />
        </View>
      </View>
      <Text style={[styles.time, { color: theme.ink3 }]}>{timeLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 6,
    paddingRight: 16,
    gap: 12,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.bold,
  },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  played: {
    height: 3,
    borderRadius: 2,
  },
  time: {
    fontFamily: fonts.sans,
    fontSize: type.meta,
    fontWeight: fontWeight.regular,
  },
});
