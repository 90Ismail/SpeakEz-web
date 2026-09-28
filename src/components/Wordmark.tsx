import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { setDemoEnabled, useDemoState } from "../demo";
import { textStyle, useTheme } from "../theme";

type WordmarkProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * The "speakez" wordmark (Newsreader italic) that sits top-left of the map.
 * Long-pressing it toggles demo mode, the hidden gesture the eyebrow also keeps.
 */
export function Wordmark({ style }: WordmarkProps) {
  const theme = useTheme();
  const demo = useDemoState();
  return (
    <Pressable
      onLongPress={() => setDemoEnabled(!demo.enabled)}
      accessibilityRole="button"
      accessibilityLabel={demo.enabled ? "SpeakEz, demo mode on" : "SpeakEz"}
      accessibilityHint="Long press to toggle demo mode"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.wordmark, style]}
    >
      <Text style={[styles.text, { color: theme.ink }]}>speakez</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    height: 48,
    justifyContent: "center",
  },
  text: {
    ...textStyle.wordmark,
    lineHeight: 32,
  },
});
