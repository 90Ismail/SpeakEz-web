import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { landmarkById } from "../src/campusLandmarks";
import { FloatingNav } from "../src/components/FloatingNav";
import { IconButton } from "../src/components/IconButton";
import { formatDuration, ListRow } from "../src/components/ListRow";
import { NowPlayingBar } from "../src/components/NowPlayingBar";
import { SEED_NOTES, type SeedNote } from "../src/seedNotes";
import { fonts, type, useTheme } from "../src/theme";

type SavedState = "playing" | "heard" | "paused" | "locked" | "new";

const ROW_STATES: SavedState[] = ["playing", "heard", "new", "paused", "new", "locked", "new", "new"];

const FADE_STEPS = [0.25, 0.5, 0.75, 1];

const NOW_PLAYING_SEC = 48;

type RowMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent: boolean;
};

function rowMeta(state: SavedState, note: SeedNote, playing: boolean): RowMeta {
  const duration = formatDuration(note.durationSec);
  if (state === "playing") {
    return playing
      ? { icon: "stats-chart-outline", label: `Playing · 0:48 of ${duration}`, accent: true }
      : { icon: "pause-circle-outline", label: "Paused at 0:48", accent: false };
  }
  if (state === "heard") return { icon: "checkmark", label: `${duration} · Heard to the end`, accent: false };
  if (state === "paused") return { icon: "pause-circle-outline", label: `${duration} · Paused at 1:10`, accent: false };
  if (state === "locked") return { icon: "location-outline", label: `${duration} · Listen within 150 m`, accent: false };
  return { icon: "ellipse-outline", label: `${duration} · Not played yet`, accent: false };
}

type PlayCircleProps = {
  state: SavedState;
  playing: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

function PlayCircle({ state, playing, onPress, accessibilityLabel }: PlayCircleProps) {
  const theme = useTheme();
  const filled = state === "playing";
  const icon = filled ? (playing ? "pause" : "play") : state === "locked" ? "lock-closed-outline" : "play";
  const circleStyle = filled
    ? { backgroundColor: theme.accent, borderColor: theme.accent }
    : {
        backgroundColor: state === "locked" ? theme.tint : theme.surfaceClear,
        borderColor: theme.controlLine,
      };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.playCircle, circleStyle, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={filled ? 16 : 13} color={filled ? theme.onAccent : theme.ink} />
    </Pressable>
  );
}

export default function SavedAudioScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(true);

  const nowPlaying = SEED_NOTES[0];
  const totalSec = SEED_NOTES.reduce((sum, note) => sum + note.durationSec, 0);
  const sub = `${SEED_NOTES.length} notes · about ${Math.floor(totalSec / 60)} minutes of listening`;
  const navBottom = insets.bottom + 4;
  const barBottom = navBottom + 62 + 14;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.bg }}>
        <View style={styles.topBar}>
          <IconButton
            icon="arrow-back"
            variant="tint"
            size={44}
            iconSize={19}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          />
          <Text style={[styles.topBarTitle, { color: theme.ink }]}>Saved Audio</Text>
          <IconButton
            icon="search"
            variant="tint"
            size={44}
            iconSize={18}
            onPress={() => {}}
            accessibilityLabel="Search saved audio"
          />
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: barBottom + 56 + 24 }}
      >
        <View style={styles.titleBlock}>
          <Text style={[styles.screenTitle, { color: theme.ink }]}>Saved Audio</Text>
          <Text style={[styles.screenSub, { color: theme.ink2 }]}>{sub}</Text>
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }}>
          {SEED_NOTES.map((note, index) => {
            const landmark = landmarkById(note.landmarkId);
            const landmarkName = landmark?.name ?? "Campus";
            const state = ROW_STATES[index] ?? "new";
            const active = state === "playing" && playing;
            const meta = rowMeta(state, note, active);
            const metaColor = meta.accent ? theme.accentText : theme.ink2;
            const label =
              state === "locked"
                ? `Locked: walk closer to listen to ${note.title}`
                : `${active ? "Pause" : "Play"} ${note.title}`;
            return (
              <ListRow
                key={note.id}
                leading={
                  <PlayCircle
                    state={state}
                    playing={active}
                    onPress={() => router.push(`/story/${note.id}`)}
                    accessibilityLabel={label}
                  />
                }
                eyebrow={landmarkName.toUpperCase()}
                eyebrowTone={meta.accent ? "accent" : "ink3"}
                title={note.title}
                trailing={
                  <IconButton
                    icon="ellipsis-horizontal"
                    variant="plain"
                    iconSize={18}
                    onPress={() => {}}
                    accessibilityLabel={`More options for ${note.title}`}
                  />
                }
                onPress={() => router.push(`/story/${note.id}`)}
                accessibilityLabel={`Open ${note.title} at ${landmarkName}`}
              >
                <View style={styles.metaRow}>
                  <Ionicons name={meta.icon} size={13} color={meta.accent ? theme.accentText : theme.ink3} />
                  <Text style={[styles.metaText, { color: metaColor }, meta.accent && styles.metaStrong]}>
                    {meta.label}
                  </Text>
                </View>
              </ListRow>
            );
          })}
        </View>
      </ScrollView>
      <View pointerEvents="none" style={styles.fade}>
        {FADE_STEPS.map((opacity) => (
          <View key={opacity} style={{ flex: 1, backgroundColor: theme.bg, opacity }} />
        ))}
      </View>
      <NowPlayingBar
        title={nowPlaying.title}
        timeLabel="0:48"
        progress={NOW_PLAYING_SEC / nowPlaying.durationSec}
        playing={playing}
        onPress={() => router.push(`/story/${nowPlaying.id}`)}
        onToggle={() => setPlaying((value) => !value)}
        style={[styles.nowPlaying, { bottom: barBottom }]}
      />
      <View pointerEvents="box-none" style={[styles.navWrap, { bottom: navBottom }]}>
        <FloatingNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 24,
    gap: 8,
  },
  topBarTitle: {
    flex: 1,
    fontFamily: fonts.sansSemibold,
    fontSize: type.body },
  titleBlock: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 4,
  },
  screenTitle: {
    fontFamily: fonts.sansBold,
    fontSize: type.display,
    letterSpacing: -1 },
  screenSub: {
    fontFamily: fonts.sans,
    fontSize: type.body },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: type.support },
  metaStrong: {
    fontFamily: fonts.sansBold,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  nowPlaying: {
    position: "absolute",
    left: 24,
    right: 24,
  },
  navWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
