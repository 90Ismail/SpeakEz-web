import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { landmarkById } from "./campusLandmarks";
import { Waveform } from "./components/Waveform";
import { UNLOCK_RADIUS_M } from "./config";
import { formatDistance } from "./geo";
import type { SeedNote } from "./seedNotes";
import { motion, pressed as pressedOpacity, radius, shadow, textStyle, useTheme } from "./theme";

const CARD_HEIGHT = 460;
const FADE_OPACITIES = [0.2, 0.45, 0.7, 0.9];

type VoiceCardProps = {
  note: SeedNote | null;
  distance: number | null;
  onOpen: (note: SeedNote) => void;
};

function seedFromId(id: string): number {
  let value = 0;
  for (let index = 0; index < id.length; index += 1) {
    value = (value * 31 + id.charCodeAt(index)) % 100000;
  }
  return value;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function VoiceCard({ note, distance, onOpen }: VoiceCardProps) {
  const theme = useTheme();
  const [rendered, setRendered] = useState<SeedNote | null>(null);
  const translateY = useRef(new Animated.Value(CARD_HEIGHT)).current;

  useEffect(() => {
    if (note) {
      setRendered(note);
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.settle,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (!rendered) return;
    Animated.timing(translateY, {
      toValue: CARD_HEIGHT,
      duration: motion.settle,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(null);
    });
  }, [note, rendered, translateY]);

  if (!rendered) return null;

  const landmark = landmarkById(rendered.landmarkId);
  const unlocked = distance !== null && distance <= UNLOCK_RADIUS_M;
  const minutes = Math.round(rendered.durationSec / 60);
  const lockedMessage =
    distance === null
      ? "Walk closer to listen"
      : `Walk ${formatDistance(Math.max(distance - UNLOCK_RADIUS_M, 10))} closer to listen`;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          shadowColor: theme.glassShadow,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={unlocked ? () => onOpen(rendered) : undefined}
        accessibilityRole={unlocked ? "button" : "text"}
        accessibilityLabel={
          unlocked
            ? `Open story: ${rendered.title} · ${landmark?.name ?? ""}`
            : `${rendered.title}, locked`
        }
        accessibilityHint={unlocked ? undefined : lockedMessage}
        style={styles.content}
      >
        <View style={styles.grabberRow}>
          <View style={[styles.grabber, { backgroundColor: theme.line }]} />
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location" size={12} color={theme.accentText} />
          <Text numberOfLines={1} style={[styles.location, { color: theme.accentText }]}>
            {(landmark?.name ?? "University of Minnesota").toUpperCase()}
          </Text>
          {distance !== null ? (
            <Text style={[styles.distance, { color: theme.ink3 }]}>
              {`·  ${formatDistance(distance)} from you`}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.title, { color: theme.ink }]}>{rendered.title}</Text>

        {unlocked ? (
          <>
            <Text style={[styles.meta, { color: theme.ink3 }]}>
              {`Anonymous student  ·  ${minutes} min listen  ·  Left ${rendered.dayLabel}`}
            </Text>

            <View style={styles.player}>
              <Pressable
                onPress={() => onOpen(rendered)}
                accessibilityRole="button"
                accessibilityLabel={`Play ${rendered.title}`}
                style={({ pressed }) => [
                  styles.playButton,
                  { backgroundColor: theme.accent, opacity: pressed ? pressedOpacity.dim : 1 },
                ]}
              >
                <Ionicons name="play" size={17} color={theme.onAccent} />
              </Pressable>
              <Waveform progress={0} seed={seedFromId(rendered.id)} style={styles.waveform} />
              <Text style={[styles.duration, { color: theme.ink2 }]}>
                {`0:00 / ${formatDuration(rendered.durationSec)}`}
              </Text>
            </View>

            <View style={styles.excerpt}>
              <Text
                numberOfLines={3}
                style={[styles.excerptText, { color: theme.ink2 }]}
              >
                {rendered.body.join("\n\n")}
              </Text>
              <View pointerEvents="none" style={styles.excerptFade}>
                {FADE_OPACITIES.map((opacity, index) => (
                  <View key={index} style={{ flex: 1, backgroundColor: theme.surface, opacity }} />
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.lockedRow}>
            <Ionicons name="lock-closed-outline" size={16} color={theme.ink3} />
            <Text style={[styles.lockedText, { color: theme.ink2 }]}>{lockedMessage}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingRight: 24,
    paddingBottom: 34,
    paddingLeft: 24,
    ...shadow.sheet,
  },
  content: {
    gap: 6,
  },
  grabberRow: {
    alignItems: "center",
    paddingBottom: 10,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 2,
  },
  location: {
    ...textStyle.caps,
    flexShrink: 1,
  },
  distance: {
    ...textStyle.meta,
  },
  title: {
    ...textStyle.titleSerif,
  },
  meta: {
    ...textStyle.support,
  },
  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: {
    flex: 1,
  },
  duration: {
    ...textStyle.support,
  },
  excerpt: {
    paddingTop: 14,
  },
  excerptText: {
    ...textStyle.excerpt,
  },
  excerptFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lockedText: {
    ...textStyle.support,
  },
});
