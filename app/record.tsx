import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecordCaptureStage } from "../src/components/RecordCaptureStage";
import { RecordPlaceStage, type PlaceChoice } from "../src/components/RecordPlaceStage";
import { RecordProcessingStage } from "../src/components/RecordProcessingStage";
import {
  RecordReviewStage,
  type ReviewParagraph,
  type ReviewSentence,
} from "../src/components/RecordReviewStage";
import { TopBar } from "../src/components/TopBar";
import { IconButton } from "../src/components/IconButton";
import { CAMPUS_LANDMARKS } from "../src/campusLandmarks";
import { CAMPUS_CENTER } from "../src/config";
import { useDemoState } from "../src/demo";
import { haversineMeters, type LatLng } from "../src/geo";
import { SEED_NOTES } from "../src/seedNotes";
import { useTheme } from "../src/theme";
import { landmarkInZone, zoneAt, type CampusZone } from "../src/zones";

type Stage = "record" | "place" | "processing" | "review";

const MAX_SECONDS = 180;
const TAP_THRESHOLD_MS = 350;
const SUGGESTIONS = ["Tired, and still trying", "The lights upstairs flicker off"];

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = "";
  for (const char of text) {
    current += char;
    if (char === "." || char === "!" || char === "?") {
      sentences.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences;
}

function toSentences(prefix: string, text: string): ReviewSentence[] {
  return splitSentences(text).map((sentence, index) => ({ id: `${prefix}-${index}`, text: sentence }));
}

function buildTranscript(): ReviewParagraph[] {
  const note = SEED_NOTES.find((seed) => seed.id === "tired-at-walter") ?? SEED_NOTES[0];
  const body = note.body;
  const redactionSentences = splitSentences(body[1] ?? "");
  const redactionText = [
    redactionSentences[0],
    (redactionSentences[1] ?? "").replace("My advisor,", "My advisor, [name removed],"),
  ]
    .filter(Boolean)
    .join(" ");
  const closing = [body[2], body[3]].filter(Boolean).join(" ");
  return [
    { id: "p1", tone: "ink", kind: "plain", sentences: toSentences("p1", body[0] ?? "") },
    { id: "p2", tone: "ink", kind: "redaction", sentences: toSentences("p2", redactionText) },
    { id: "p3", tone: "ink2", kind: "plain", sentences: toSentences("p3", closing) },
  ];
}

const TRANSCRIPT = buildTranscript();

function mockTitle(): string {
  const firstSentence = TRANSCRIPT[0]?.sentences[0]?.text ?? "A note from campus";
  const words = firstSentence.split(/\s+/).slice(0, 7).join(" ").replace(/[,;:.!?]+$/, "");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function nearestLandmark(position: LatLng) {
  return CAMPUS_LANDMARKS.reduce((best, landmark) =>
    haversineMeters(position, landmark.coordinate) < haversineMeters(position, best.coordinate)
      ? landmark
      : best,
  );
}

export default function RecordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const demo = useDemoState();

  const [stage, setStage] = useState<Stage>("record");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [position, setPosition] = useState<LatLng>(CAMPUS_CENTER);
  const [choice, setChoice] = useState<PlaceChoice>("spot");
  const [title, setTitle] = useState(mockTitle);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [mockPlaying, setMockPlaying] = useState(false);

  const recorderFailedRef = useRef(false);
  const permissionGrantedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const elapsedRef = useRef(0);
  const startedAtRef = useRef(0);
  const tapArmedRef = useRef(false);
  const justArmedRef = useRef(false);
  const swallowPressRef = useRef(false);
  const pressStartRef = useRef(0);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.hasError) recorderFailedRef.current = true;
  });

  const setRecording = useCallback((value: boolean) => {
    isRecordingRef.current = value;
    setIsRecording(value);
  }, []);

  const updateElapsed = useCallback((value: number) => {
    elapsedRef.current = value;
    setElapsedSec(value);
  }, []);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    const checkPermission = () => {
      AudioModule.getRecordingPermissionsAsync()
        .then((response) => {
          permissionGrantedRef.current = response.granted;
          setPermissionDenied(!response.granted && response.status === "denied");
        })
        .catch(() => {});
    };
    checkPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") checkPermission();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (demo.fakePosition) {
      setPosition(demo.fakePosition);
      return undefined;
    }
    let active = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return;
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (active) {
          setPosition({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch {
        if (active) setPosition(CAMPUS_CENTER);
      }
    })();
    return () => {
      active = false;
    };
  }, [demo.fakePosition]);

  useEffect(
    () => () => {
      if (isRecordingRef.current) {
        recorder.stop().catch(() => {});
      }
    },
    [recorder],
  );

  const finishRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;
    setRecording(false);
    tapArmedRef.current = false;
    if (!recorderFailedRef.current) {
      try {
        await recorder.stop();
        if (recorder.uri) setRecordedUri(recorder.uri);
      } catch {
        recorderFailedRef.current = true;
      }
    }
  }, [recorder, setRecording]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    setRecordedUri(null);
    updateElapsed(0);
    startedAtRef.current = Date.now();
    try {
      let granted = permissionGrantedRef.current;
      if (!granted) {
        const response = await AudioModule.requestRecordingPermissionsAsync();
        granted = response.granted;
        permissionGrantedRef.current = granted;
        setPermissionDenied(!granted);
        if (!granted) return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_SECONDS });
      setRecording(true);
    } catch {
      recorderFailedRef.current = true;
      setRecording(true);
    }
  }, [recorder, setRecording, updateElapsed]);

  useEffect(() => {
    if (!isRecording) return undefined;
    const id = setInterval(() => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      if (seconds >= MAX_SECONDS) {
        updateElapsed(MAX_SECONDS);
        void finishRecording();
        return;
      }
      updateElapsed(seconds);
    }, 200);
    return () => clearInterval(id);
  }, [isRecording, finishRecording, updateElapsed]);

  const hasRecording = !isRecording && elapsedSec >= 1;

  const advanceToPlace = useCallback(() => {
    if (elapsedRef.current < 1 || isRecordingRef.current) return;
    setStage("place");
  }, []);

  const onPrimaryPressIn = useCallback(() => {
    if (isRecordingRef.current) {
      swallowPressRef.current = true;
      void finishRecording();
      return;
    }
    if (elapsedRef.current >= 1) return;
    void startRecording();
    pressStartRef.current = Date.now();
  }, [finishRecording, startRecording]);

  const onPrimaryPressOut = useCallback(() => {
    if (!isRecordingRef.current || tapArmedRef.current) return;
    const heldMs = Date.now() - pressStartRef.current;
    if (heldMs < TAP_THRESHOLD_MS) {
      tapArmedRef.current = true;
      justArmedRef.current = true;
      return;
    }
    swallowPressRef.current = true;
    void finishRecording();
  }, [finishRecording]);

  const onPrimaryPress = useCallback(() => {
    if (swallowPressRef.current) {
      swallowPressRef.current = false;
      return;
    }
    if (justArmedRef.current) {
      justArmedRef.current = false;
      return;
    }
    if (isRecordingRef.current) {
      void finishRecording();
      return;
    }
    if (elapsedRef.current >= 1) {
      advanceToPlace();
      return;
    }
    void startRecording();
  }, [advanceToPlace, finishRecording, startRecording]);

  const onRestart = useCallback(async () => {
    if (isRecordingRef.current) await finishRecording();
    setRecordedUri(null);
    await startRecording();
  }, [finishRecording, startRecording]);

  const onDone = useCallback(() => {
    advanceToPlace();
  }, [advanceToPlace]);

  const toggleSentence = useCallback((id: string) => {
    setExcluded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const player = useAudioPlayer(recordedUri ? { uri: recordedUri } : null);
  const playerStatus = useAudioPlayerStatus(player);
  const playing = recordedUri ? playerStatus.playing : mockPlaying;

  const togglePlayback = useCallback(() => {
    if (recordedUri) {
      if (playerStatus.playing) player.pause();
      else player.play();
      return;
    }
    setMockPlaying((value) => !value);
  }, [player, playerStatus.playing, recordedUri]);

  const zone: CampusZone | null = useMemo(() => zoneAt(position), [position]);
  const spotLandmark = useMemo(() => nearestLandmark(position), [position]);
  const campusLandmark = useMemo(
    () => (zone ? (landmarkInZone(zone, position) ?? spotLandmark) : spotLandmark),
    [position, spotLandmark, zone],
  );

  const primaryMode = isRecording ? "stop" : hasRecording ? "continue" : "record";

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {stage === "record" ? (
        <>
          <TopBar
            title="New voice note"
            leading={{ icon: "close", label: "Close without posting", onPress: () => router.back() }}
            trailing={
              <IconButton
                icon="information-circle-outline"
                accessibilityLabel="How it works"
                accessibilityHint="Explains what happens to your recording"
                onPress={() => {}}
                size={44}
                iconSize={18}
              />
            }
          />
          <RecordCaptureStage
            landmarkName={spotLandmark.name}
            elapsedSec={elapsedSec}
            maxSec={MAX_SECONDS}
            isRecording={isRecording}
            hasRecording={hasRecording}
            permissionDenied={permissionDenied}
            primaryMode={primaryMode}
            onPrimaryPressIn={onPrimaryPressIn}
            onPrimaryPressOut={onPrimaryPressOut}
            onPrimaryPress={onPrimaryPress}
            onRestart={onRestart}
            onDone={onDone}
            primaryLabel={isRecording ? "Stop recording" : hasRecording ? "Continue" : "Record a voice note"}
          />
        </>
      ) : null}

      {stage === "place" ? (
        <RecordPlaceStage
          zone={zone}
          spotLandmark={spotLandmark}
          campusLandmark={campusLandmark}
          choice={choice}
          onChangeChoice={setChoice}
          onBack={() => setStage("record")}
          onContinue={() => setStage("processing")}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      ) : null}

      {stage === "processing" ? (
        <RecordProcessingStage onDone={() => setStage("review")} topInset={insets.top} />
      ) : null}

      {stage === "review" ? (
        <RecordReviewStage
          landmarkName={(choice === "campus" ? campusLandmark : spotLandmark).name}
          locationSuffix={choice === "campus" ? "ON CAMPUS" : choice === "draft" ? "DRAFT" : "THIS SPOT"}
          title={title}
          onChangeTitle={setTitle}
          suggestions={SUGGESTIONS}
          onSuggestion={setTitle}
          playing={playing}
          onTogglePlayback={togglePlayback}
          durationSec={elapsedSec}
          paragraphs={TRANSCRIPT}
          excludedIds={excluded}
          onToggleSentence={toggleSentence}
          onBack={() => setStage("place")}
          onDiscard={() => router.back()}
          onPublish={() => router.replace("/")}
          onKeepDraft={() => router.back()}
          draftOnly={choice === "draft"}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
