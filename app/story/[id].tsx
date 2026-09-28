import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { unlockNote } from "../../src/api";
import { landmarkById, type CampusLandmark } from "../../src/campusLandmarks";
import { IconButton } from "../../src/components/IconButton";
import { ReactionButton } from "../../src/components/ReactionButton";
import { Waveform } from "../../src/components/Waveform";
import { USE_GOOGLE_ON_IOS } from "../../src/config";
import { formatDistanceUpper, haversineMeters, type LatLng } from "../../src/geo";
import { googleMapStyle } from "../../src/mapStyle";
import { formatClock, formatRate, useNotePlayer } from "../../src/Player";
import { REACTIONS, type ReactionType } from "../../src/reactions";
import { SEED_NOTES, seedNoteById } from "../../src/seedNotes";
import {
  fonts,
  pressed as pressedOpacity,
  radius,
  shadow,
  space,
  textStyle,
  type,
  useTheme,
  useThemeMode,
} from "../../src/theme";
import { buildWordTimings, currentParagraphAt, type WordTiming } from "../../src/transcript";

const MAP_LATITUDE_DELTA = 0.006;
const HEADER_HEIGHT = 252;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function bearingDegrees(from: LatLng, to: LatLng): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function compassDirection(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 45) % 8];
}

function waveSeed(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 1000000;
  }
  return hash || 1;
}

type StoryNote = {
  id: string;
  title: string;
  landmarkId: string;
  durationSec: number;
  dayLabel: string;
  body: string[];
};

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type NextStory = {
  note: StoryNote;
  landmark: CampusLandmark;
  meters: number;
  direction: string;
};

function nearestOtherStory(note: StoryNote, landmark: CampusLandmark): NextStory | null {
  let nearest: NextStory | null = null;
  for (const candidate of SEED_NOTES) {
    if (candidate.id === note.id) continue;
    const candidateLandmark = landmarkById(candidate.landmarkId);
    if (!candidateLandmark) continue;
    const meters = haversineMeters(landmark.coordinate, candidateLandmark.coordinate);
    if (!nearest || meters < nearest.meters) {
      nearest = {
        note: candidate,
        landmark: candidateLandmark,
        meters,
        direction: compassDirection(bearingDegrees(landmark.coordinate, candidateLandmark.coordinate)),
      };
    }
  }
  return nearest;
}

type FadeProps = {
  height: number;
  direction?: "top" | "bottom";
};

function Fade({ height, direction = "bottom" }: FadeProps) {
  const theme = useTheme();
  const opacities = direction === "bottom" ? [0.08, 0.28, 0.55, 0.85] : [0.85, 0.55, 0.28, 0.08];
  const band = height / opacities.length;
  return (
    <View
      pointerEvents="none"
      style={[styles.fade, direction === "bottom" ? styles.fadeBottom : styles.fadeTop, { height }]}
    >
      {opacities.map((opacity, index) => (
        <View key={`${direction}-${index}`} style={{ height: band, backgroundColor: theme.bg, opacity }} />
      ))}
    </View>
  );
}

type StoryMapProps = {
  landmark: CampusLandmark;
  height: number;
  listening?: boolean;
};

function StoryMap({ landmark, height, listening = false }: StoryMapProps) {
  const theme = useTheme();
  const themeMode = useThemeMode();
  const { width } = useWindowDimensions();
  const useGoogle = Platform.OS === "android" || USE_GOOGLE_ON_IOS;
  const initialRegion = {
    latitude: landmark.coordinate.latitude,
    longitude: landmark.coordinate.longitude,
    latitudeDelta: MAP_LATITUDE_DELTA,
    longitudeDelta: MAP_LATITUDE_DELTA * (width / height),
  };
  return (
    <View pointerEvents="none" style={[styles.mapWrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        mapType={useGoogle ? "standard" : "mutedStandard"}
        customMapStyle={useGoogle ? googleMapStyle(themeMode) : undefined}
        showsPointsOfInterests={Platform.OS === "ios"}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor={theme.mapGround}
        loadingIndicatorColor={theme.accent}
        pointerEvents="none"
      >
        <Marker coordinate={landmark.coordinate} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.pinWrap}>
            {listening && (
              <View
                style={[styles.pinHalo, { backgroundColor: theme.accentWash, borderColor: theme.accentLine }]}
              />
            )}
            <View style={[styles.pinDot, { backgroundColor: theme.accent, borderColor: theme.ring }]} />
          </View>
        </Marker>
      </MapView>
    </View>
  );
}

export default function StoryScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    unlocked?: string | string[];
    title?: string | string[];
    landmarkId?: string | string[];
    durationSec?: string | string[];
    dayLabel?: string | string[];
    lat?: string | string[];
    lng?: string | string[];
  }>();
  const noteId = singleParam(params.id);
  const paramTitle = singleParam(params.title);
  const paramLandmarkId = singleParam(params.landmarkId);
  const paramDurationSec = singleParam(params.durationSec);
  const paramDayLabel = singleParam(params.dayLabel);
  const unlockedParam = singleParam(params.unlocked);
  const latParam = singleParam(params.lat);
  const lngParam = singleParam(params.lng);
  const note = useMemo<StoryNote | undefined>(() => {
    if (noteId && paramTitle && paramLandmarkId) {
      const duration = Number(paramDurationSec ?? 0);
      return {
        id: noteId,
        title: paramTitle,
        landmarkId: paramLandmarkId,
        durationSec: Number.isFinite(duration) ? duration : 0,
        dayLabel: paramDayLabel ?? "",
        body: [],
      };
    }
    return noteId ? seedNoteById(noteId) : undefined;
  }, [noteId, paramTitle, paramLandmarkId, paramDurationSec, paramDayLabel]);
  const landmark = note ? landmarkById(note.landmarkId) : undefined;
  const durationSec = note?.durationSec ?? 0;
  const position = useMemo(() => {
    const lat = Number(latParam);
    const lng = Number(lngParam);
    if (!latParam || !lngParam || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [latParam, lngParam]);

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [reaction, setReaction] = useState<ReactionType | null>(null);
  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const [trackWidth, setTrackWidth] = useState(0);
  const [body, setBody] = useState<string[]>(note?.body ?? []);
  const [words, setWords] = useState<WordTiming[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [access, setAccess] = useState<"checking" | "unlocked" | "locked">(() => {
    if ((note?.body.length ?? 0) > 0) return "unlocked";
    if (!position || unlockedParam === "0") return "locked";
    return "checking";
  });

  useEffect(() => {
    if (access !== "checking" || !note || !position) return;
    let cancelled = false;
    unlockNote(note.id, position)
      .then((result) => {
        if (cancelled) return;
        setBody(result.body);
        setWords(result.words);
        setAudioUrl(result.audioUrl);
        setAccess("unlocked");
      })
      .catch(() => {
        if (cancelled) return;
        setAccess("locked");
      });
    return () => {
      cancelled = true;
    };
  }, [access, note, position]);

  const player = useNotePlayer(audioUrl, durationSec);
  const timings = useMemo(
    () => buildWordTimings(body, words, durationSec),
    [body, words, durationSec],
  );
  const next = useMemo(
    () => (note && landmark ? nearestOtherStory(note, landmark) : null),
    [note, landmark],
  );
  const unlocked = access !== "locked";
  const playbackStarted = player.playing || player.currentTime > 0;
  const totalDuration = player.duration > 0 ? player.duration : durationSec;
  const progress = totalDuration > 0 ? player.currentTime / totalDuration : 0;
  const currentIndex = currentParagraphAt(timings, player.currentTime);

  const scrollRef = useRef<ScrollView>(null);
  const transcriptOffsetRef = useRef(0);
  const paragraphOffsetsRef = useRef<number[]>([]);
  const lastScrolledIndexRef = useRef<number | null>(null);
  const isScrubbingRef = useRef(false);
  const lastTimeRef = useRef(0);
  const trackWidthRef = useRef(1);
  const dragStartRef = useRef(0);
  const durationRef = useRef(durationSec);
  durationRef.current = durationSec;
  const seekToRef = useRef(player.seekTo);
  seekToRef.current = player.seekTo;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          isScrubbingRef.current = true;
          const percent = clamp(event.nativeEvent.locationX / trackWidthRef.current, 0, 1);
          dragStartRef.current = percent;
          seekToRef.current(percent * durationRef.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const percent = clamp(dragStartRef.current + gesture.dx / trackWidthRef.current, 0, 1);
          seekToRef.current(percent * durationRef.current);
        },
        onPanResponderRelease: () => {
          isScrubbingRef.current = false;
        },
        onPanResponderTerminate: () => {
          isScrubbingRef.current = false;
        },
      }),
    [],
  );

  useEffect(() => {
    const previousTime = lastTimeRef.current;
    lastTimeRef.current = player.currentTime;
    if (lastScrolledIndexRef.current === currentIndex) return;
    lastScrolledIndexRef.current = currentIndex;
    if (!player.playing || !transcriptVisible || isScrubbingRef.current) return;
    if (Math.abs(player.currentTime - previousTime) > 1.5) return;
    const offset = paragraphOffsetsRef.current[currentIndex];
    if (offset === undefined) return;
    scrollRef.current?.scrollTo({
      y: Math.max(transcriptOffsetRef.current + offset - 80, 0),
      animated: true,
    });
  }, [currentIndex, player.currentTime, player.playing, transcriptVisible]);

  if (!note || !landmark) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.bg }]}>
        <Text style={[styles.caps, { color: theme.ink3 }]}>STORY NOT FOUND</Text>
        <Text style={[styles.missingText, { color: theme.ink2 }]}>
          This voice note is no longer on the map.
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.missingButton,
            { backgroundColor: theme.accentSoft, opacity: pressed ? pressedOpacity.soft : 1 },
          ]}
        >
          <Text style={[styles.missingButtonText, { color: theme.accentText }]}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const minutes = Math.max(1, Math.round(durationSec / 60));
  const metaLine = `Anonymous student · ${minutes} min listen · Left ${note.dayLabel}`;
  const nextLine = next
    ? `${next.landmark.name.toUpperCase()}  ·  ${formatDistanceUpper(next.meters)} ${next.direction}`
    : "";

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + (playbackStarted ? 96 : 0) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapHeader}>
          <StoryMap landmark={landmark} height={HEADER_HEIGHT} listening={player.playing} />
          <Fade direction="top" height={96} />
          <Fade direction="bottom" height={55} />
          {playbackStarted ? (
            <View pointerEvents="none" style={styles.listeningWrap}>
              <View style={[styles.listeningChip, { backgroundColor: theme.ink, borderColor: theme.ink }]}>
                <Ionicons name="headset-outline" size={14} color={theme.accent} />
                <Text style={[styles.listeningChipText, { color: theme.surface }]}>Listening here</Text>
              </View>
            </View>
          ) : null}
          <IconButton
            icon="chevron-down"
            variant="glass"
            accessibilityLabel="Back to map"
            onPress={() => router.back()}
            style={[styles.headerLeft, { top: insets.top + 6 }]}
          />
          <IconButton
            icon={saved ? "bookmark" : "bookmark-outline"}
            variant="glass"
            accessibilityLabel={saved ? "Saved" : "Save story"}
            onPress={() => setSaved((value) => !value)}
            style={[styles.headerRight, { top: insets.top + 6 }]}
          />
        </View>
        <View style={styles.article}>
          <Text style={[styles.caps, { color: theme.accentText }]}>
            {`${landmark.name.toUpperCase()}${playbackStarted ? "  ·  NOW PLAYING" : ""}`}
          </Text>
          <View style={styles.headlineBlock}>
                <Text style={[styles.headline, { color: theme.ink }]}>{note.title}</Text>
              </View>
              {unlocked ? (
                <>
                  <View style={styles.metaBlock}>
                    <Text style={[styles.metaText, { color: theme.ink3 }]}>{metaLine}</Text>
                  </View>
                  <View style={[styles.audioBlock, { borderColor: theme.line }]}>
                    <View style={styles.audioRow}>
                      <Pressable
                        onPress={player.toggle}
                        accessibilityRole="button"
                        accessibilityLabel={player.playing ? "Pause story" : "Play story"}
                        style={({ pressed }) => [
                          styles.playButton,
                          { backgroundColor: theme.accent, opacity: pressed ? pressedOpacity.dim : 1 },
                        ]}
                      >
                        <Ionicons
                          name={player.playing ? "pause" : "play"}
                          size={18}
                          color={theme.onAccent}
                        />
                      </Pressable>
                      <Waveform
                        progress={progress}
                        seed={waveSeed(note.id)}
                        height={28}
                        style={styles.audioWave}
                      />
                      <Text style={[styles.audioTime, { color: theme.ink2 }]}>
                        {`${formatClock(player.currentTime)} / ${formatClock(totalDuration)}`}
                      </Text>
                    </View>
                    {playbackStarted ? (
                      <View
                        style={styles.scrubber}
                        onLayout={(event) => {
                          trackWidthRef.current = event.nativeEvent.layout.width;
                          setTrackWidth(event.nativeEvent.layout.width);
                        }}
                        accessibilityRole="adjustable"
                        accessibilityLabel="Seek through the story"
                        accessibilityValue={{
                          min: 0,
                          max: Math.round(totalDuration),
                          now: Math.round(player.currentTime),
                        }}
                        {...panResponder.panHandlers}
                      >
                        <View style={[styles.scrubberTrack, { backgroundColor: theme.waveMuted }]} />
                        <View
                          style={[
                            styles.scrubberProgress,
                            { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.accent },
                          ]}
                        />
                        {trackWidth > 0 && (
                          <View
                            style={[
                              styles.scrubberKnob,
                              {
                                left: clamp(progress * trackWidth - 8, 0, Math.max(trackWidth - 16, 0)),
                                backgroundColor: theme.accent,
                                borderColor: theme.ring,
                              },
                            ]}
                          />
                        )}
                      </View>
                    ) : null}
                  </View>
                  {transcriptVisible ? (
                    <View
                      style={styles.transcript}
                      onLayout={(event) => {
                        transcriptOffsetRef.current = event.nativeEvent.layout.y;
                      }}
                    >
                    {timings.map((timing) => {
                      const isCurrent = playbackStarted && timing.index === currentIndex;
                      const color = playbackStarted
                        ? isCurrent
                          ? theme.ink
                          : timing.index < currentIndex
                            ? theme.ink2
                            : theme.ink3
                        : theme.ink;
                      return (
                        <Pressable
                          key={timing.index}
                          onPress={() => player.seekTo(timing.startSec)}
                          accessibilityRole="button"
                          accessibilityLabel="Play from this paragraph"
                          style={[
                            styles.paragraphWrap,
                            isCurrent && [styles.paragraphCurrent, { borderLeftColor: theme.accent }],
                          ]}
                          onLayout={(event) => {
                            paragraphOffsetsRef.current[timing.index] = event.nativeEvent.layout.y;
                          }}
                        >
                          <Text style={[styles.paragraph, { color }]}>{timing.text}</Text>
                        </Pressable>
                      );
                    })}
                    </View>
                  ) : null}
                  <View style={styles.endMark}>
                    <Text style={[styles.endMarkText, { color: theme.ink3 }]}>·  ·  ·</Text>
                  </View>
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.ink2 }]}>Leave a quiet response</Text>
                    <View style={styles.responses}>
                      {[REACTIONS.slice(0, 2), REACTIONS.slice(2, 4)].map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.responseRow}>
                          {row.map((item) => (
                            <ReactionButton
                              key={item.type}
                              label={item.label}
                              selected={reaction === item.type}
                              onPress={() =>
                                setReaction((current) => (current === item.type ? null : item.type))
                              }
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                    {reaction !== null && (
                      <Text style={[styles.caps, styles.heardByMany, { color: theme.ink3 }]}>
                        HEARD BY MANY
                      </Text>
                    )}
                  </View>
                  {next && (
                    <View style={styles.section}>
                      <Text style={[styles.sectionLabel, { color: theme.ink2 }]}>Continue walking</Text>
                      <Pressable
                        onPress={() => router.push(`/story/${next.note.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`Next story: ${next.note.title}, ${formatDistanceUpper(next.meters)} ${next.direction} at ${next.landmark.name}`}
                        style={({ pressed }) => [
                          styles.nextRow,
                          { backgroundColor: pressed ? theme.tint : theme.surfaceClear },
                        ]}
                      >
                        <View style={[styles.nextCircle, { backgroundColor: theme.accentSoft }]}>
                          <Text style={[styles.nextCompass, { color: theme.accentText }]}>{next.direction}</Text>
                        </View>
                        <View style={styles.nextText}>
                          <Text style={[styles.nextLine, { color: theme.ink3 }]} numberOfLines={1}>
                            {nextLine}
                          </Text>
                          <Text style={[styles.nextTitle, { color: theme.ink }]} numberOfLines={1}>
                            {next.note.title}
                          </Text>
                        </View>
                        <Ionicons name="arrow-forward" size={18} color={theme.ink3} />
                      </Pressable>
                    </View>
                  )}
                  <Pressable
                    onPress={() => router.push("/care")}
                    accessibilityRole="button"
                    accessibilityLabel="If this feels close to home, support is here"
                    style={({ pressed }) => [styles.support, { opacity: pressed ? pressedOpacity.dim : 1 }]}
                  >
                    <Ionicons name="help-buoy-outline" size={16} color={theme.ink2} />
                    <Text style={[styles.supportText, { color: theme.ink2 }]}>
                      If this feels close to home, support is here
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.lockedRow}>
                  <Ionicons name="lock-closed-outline" size={14} color={theme.ink3} />
                  <Text style={[styles.lockedText, { color: theme.ink3 }]}>
                    Walk closer to read and listen
                  </Text>
                </View>
              )}
        </View>
      </ScrollView>
      {playbackStarted && (
        <>
          <Fade direction="bottom" height={150} />
          <View
            pointerEvents="box-none"
            style={[styles.playerWrap, { bottom: Math.max(insets.bottom, 12) }]}
          >
            <View
              style={[
                styles.playerBar,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.line,
                  shadowColor: theme.glassShadow,
                },
              ]}
            >
              <Pressable
                onPress={player.cycleRate}
                accessibilityRole="button"
                accessibilityLabel="Playback speed"
                accessibilityHint={`Current speed ${formatRate(player.rate)}. Tap to change.`}
                style={({ pressed }) => [styles.playerButton, { opacity: pressed ? pressedOpacity.dim : 1 }]}
              >
                <Text style={[styles.playerSpeed, { color: theme.ink }]}>{formatRate(player.rate)}</Text>
              </Pressable>
              <Pressable
                onPress={() => player.skip(-15)}
                accessibilityRole="button"
                accessibilityLabel="Back 15 seconds"
                style={({ pressed }) => [styles.playerButton, { opacity: pressed ? pressedOpacity.dim : 1 }]}
              >
                <Ionicons name="play-back-outline" size={19} color={theme.ink} />
              </Pressable>
              <Pressable
                onPress={player.toggle}
                accessibilityRole="button"
                accessibilityLabel={player.playing ? "Pause story" : "Play story"}
                style={({ pressed }) => [
                  styles.playerPlay,
                  { backgroundColor: theme.accent, opacity: pressed ? pressedOpacity.dim : 1 },
                ]}
              >
                <Ionicons name={player.playing ? "pause" : "play"} size={18} color={theme.onAccent} />
              </Pressable>
              <Pressable
                onPress={() => player.skip(15)}
                accessibilityRole="button"
                accessibilityLabel="Forward 15 seconds"
                style={({ pressed }) => [styles.playerButton, { opacity: pressed ? pressedOpacity.dim : 1 }]}
              >
                <Ionicons name="play-forward-outline" size={19} color={theme.ink} />
              </Pressable>
              <Pressable
                onPress={() => setTranscriptVisible((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={transcriptVisible ? "Hide transcript" : "Show transcript"}
                accessibilityState={{ selected: transcriptVisible }}
                style={({ pressed }) => [styles.playerButton, { opacity: pressed ? pressedOpacity.dim : 1 }]}
              >
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={18}
                  color={transcriptVisible ? theme.ink : theme.ink3}
                />
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  mapHeader: { overflow: "hidden" },
  mapWrap: { width: "100%", overflow: "hidden" },
  headerLeft: { position: "absolute", left: space.gutter },
  headerRight: { position: "absolute", right: space.gutter },
  fade: { position: "absolute", left: 0, right: 0 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  listeningWrap: { position: "absolute", left: 0, right: 0, bottom: 18, alignItems: "center" },
  listeningChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.xs,
    borderWidth: 1,
    ...shadow.control,
  },
  listeningChipText: { fontFamily: fonts.sansBold, fontSize: type.support },
  pinWrap: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  pinHalo: { position: "absolute", width: 60, height: 60, borderRadius: 30, borderWidth: 1.5 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  article: { paddingTop: 16, paddingHorizontal: space.gutter, paddingBottom: 32 },
  caps: { ...textStyle.caps },
  sectionLabel: { ...textStyle.supportStrong },
  headlineBlock: { marginTop: 12, marginBottom: 16 },
  headline: { ...textStyle.displaySerif },
  metaBlock: { paddingTop: 10, paddingBottom: 20 },
  metaText: { ...textStyle.support },
  audioBlock: {
    paddingTop: 20,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  audioRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  audioWave: { flex: 1 },
  audioTime: { ...textStyle.support },
  playButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  transcript: { paddingTop: 28, paddingBottom: 24, gap: 18 },
  paragraph: { ...textStyle.reading },
  endMark: { paddingBottom: 24, alignItems: "center" },
  endMarkText: { fontFamily: fonts.serif, fontSize: type.body, textAlign: "center" },
  section: { paddingVertical: 24 },
  responses: { marginTop: 12, gap: 8 },
  responseRow: { flexDirection: "row", gap: 8 },
  heardByMany: { marginTop: 8 },
  nextRow: {
    marginTop: 12,
    marginHorizontal: -space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 44,
  },
  nextCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  nextCompass: { fontFamily: fonts.sansBold, fontSize: 14 },
  nextText: { flex: 1, gap: 3 },
  nextLine: { fontFamily: fonts.sans, fontSize: type.meta, letterSpacing: 1.2 },
  nextTitle: { ...textStyle.rowTitleSerif },
  support: { paddingTop: 14, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  supportText: { ...textStyle.support, flex: 1 },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 12 },
  lockedText: { ...textStyle.support },
  scrubber: { height: 20, justifyContent: "center", marginTop: 12 },
  scrubberTrack: { position: "absolute", left: 0, right: 0, top: 8, height: 4, borderRadius: 2 },
  scrubberProgress: { position: "absolute", left: 0, top: 8, height: 4, borderRadius: 2 },
  scrubberKnob: { position: "absolute", top: 2, width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  paragraphWrap: { position: "relative" },
  paragraphCurrent: { marginLeft: -16, paddingLeft: 14, borderLeftWidth: 2 },
  playerWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  playerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 5,
    borderRadius: 30,
    borderWidth: 1,
    ...shadow.control,
  },
  playerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  playerSpeed: { ...textStyle.support },
  playerPlay: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: space.gutter },
  missingText: { fontFamily: fonts.serif, fontSize: type.reading, textAlign: "center" },
  missingButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  missingButtonText: {
    fontFamily: fonts.sansBold,
    fontSize: type.support,
    letterSpacing: 0.8 },
});
