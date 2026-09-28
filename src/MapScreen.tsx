import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CAMPUS_LANDMARKS, landmarkById, type CampusLandmark } from "./campusLandmarks";
import { Caps } from "./components/Caps";
import { FloatingNav } from "./components/FloatingNav";
import { IconButton } from "./components/IconButton";
import { MapControls } from "./components/MapControls";
import { Wordmark } from "./components/Wordmark";
import { DEFAULT_CAMERA, SHORT_WALK_M, UNLOCK_RADIUS_M, USE_GOOGLE_ON_IOS } from "./config";
import { setDemoEnabled, setFakePosition, useDemoState } from "./demo";
import { haversineMeters, type LatLng } from "./geo";
import { googleMapStyle } from "./mapStyle";
import { CLUSTERS, NotePin, PinCluster, pinMarkerGeometry, pinStateFor, YouAreHere } from "./NotePins";
import { SEED_NOTES, seedNoteById } from "./seedNotes";
import { fonts, radius, space, textStyle, type, useTheme, useThemeMode } from "./theme";
import { VoiceCard } from "./VoiceCard";
import { ZONES } from "./zones";

const NAV_HEIGHT = 62;
const TOP_FADE_OPACITIES = [1, 0.92, 0.8, 0.6, 0.4, 0.2];
const MAP_PADDING = { top: 140, right: 8, bottom: 250, left: 8 };
const FALLBACK_LANDMARK = "Northrop Mall";
const SMALL_NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "Three voices nearby" for small counts (the editorial voice), digits beyond ten. */
function voicesNearbyLabel(count: number): string {
  const amount = count >= 0 && count < SMALL_NUMBERS.length ? SMALL_NUMBERS[count] : String(count);
  return `${amount} ${count === 1 ? "voice" : "voices"} nearby`;
}

export function MapScreen() {
  const theme = useTheme();
  const mode = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const demo = useDemoState();
  const [livePosition, setLivePosition] = useState<LatLng | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pinPressAt = useRef(0);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== "granted") return;
      const next = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5 },
        (update) => {
          setLivePosition({ latitude: update.coords.latitude, longitude: update.coords.longitude });
        },
      );
      if (cancelled) {
        next.remove();
        return;
      }
      subscription = next;
    }
    start();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  const userPosition = demo.fakePosition ?? livePosition;

  const nearestLandmark = useMemo(() => {
    if (!userPosition) return undefined;
    return CAMPUS_LANDMARKS.reduce<CampusLandmark | undefined>(
      (nearest, landmark) =>
        !nearest ||
        haversineMeters(userPosition, landmark.coordinate) < haversineMeters(userPosition, nearest.coordinate)
          ? landmark
          : nearest,
      undefined,
    );
  }, [userPosition]);

  const voicesNearby = useMemo(() => {
    if (!userPosition) return SEED_NOTES.length;
    return SEED_NOTES.filter((note) => {
      const landmark = landmarkById(note.landmarkId);
      return landmark ? haversineMeters(userPosition, landmark.coordinate) <= SHORT_WALK_M : false;
    }).length;
  }, [userPosition]);

  const selectedNote = selectedId ? seedNoteById(selectedId) ?? null : null;
  const selectedLandmark = selectedNote ? landmarkById(selectedNote.landmarkId) : undefined;
  const selectedDistance =
    selectedLandmark && userPosition ? haversineMeters(userPosition, selectedLandmark.coordinate) : null;

  const usesGoogle = Platform.OS === "android" || USE_GOOGLE_ON_IOS;

  function handleSelect(noteId: string) {
    pinPressAt.current = Date.now();
    setSelectedId(noteId);
  }

  function handleMapPress() {
    if (Date.now() - pinPressAt.current < 350) return;
    setSelectedId(null);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={usesGoogle ? PROVIDER_GOOGLE : undefined}
        initialRegion={DEFAULT_CAMERA}
        mapType={usesGoogle ? "standard" : "mutedStandard"}
        customMapStyle={usesGoogle ? googleMapStyle(mode) : undefined}
        showsPointsOfInterests={!usesGoogle}
        mapPadding={MAP_PADDING}
        onPress={handleMapPress}
        onLongPress={(event) => setFakePosition(event.nativeEvent.coordinate)}
      >
        {ZONES.map((zone) => (
          <Circle
            key={zone.id}
            center={zone.center}
            radius={zone.radiusM}
            fillColor={theme.accentClear}
            strokeColor={theme.accentLine}
            strokeWidth={1}
          />
        ))}
        {ZONES.map((zone) => (
          <Marker key={`label-${zone.id}`} coordinate={zone.center} tracksViewChanges={false} zIndex={0}>
            <Text style={[styles.zoneLabel, { color: theme.mapLabel }]}>{zone.label}</Text>
          </Marker>
        ))}
        {userPosition ? (
          <Circle
            center={userPosition}
            radius={UNLOCK_RADIUS_M}
            fillColor={theme.accentWash}
            strokeColor={theme.accentLine}
            strokeWidth={1}
          />
        ) : null}
        {SEED_NOTES.map((note) => {
          const landmark = landmarkById(note.landmarkId);
          if (!landmark) return null;
          const distance = userPosition ? haversineMeters(userPosition, landmark.coordinate) : null;
          const geometry = pinMarkerGeometry(pinStateFor(distance));
          const selected = note.id === selectedId;
          return (
            <Marker
              key={note.id}
              coordinate={landmark.coordinate}
              anchor={geometry.anchor}
              centerOffset={geometry.centerOffset}
              zIndex={selected ? 2 : 1}
              onPress={() => handleSelect(note.id)}
            >
              <NotePin note={note} distance={distance} selected={selected} onPress={() => handleSelect(note.id)} />
            </Marker>
          );
        })}
        {CLUSTERS.map((cluster) => (
          <Marker key={cluster.id} coordinate={cluster.coordinate} tracksViewChanges={false} zIndex={0}>
            <PinCluster label={cluster.label} />
          </Marker>
        ))}
        {userPosition ? (
          <Marker
            coordinate={userPosition}
            anchor={{ x: 0.5, y: 0.5 }}
            centerOffset={{ x: 0, y: 0 }}
            zIndex={0}
          >
            <YouAreHere />
          </Marker>
        ) : null}
      </MapView>

      <View pointerEvents="none" style={styles.topFade}>
        {TOP_FADE_OPACITIES.map((opacity, index) => (
          <View key={index} style={{ flex: 1, backgroundColor: theme.bg, opacity }} />
        ))}
      </View>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={styles.controlsRow} pointerEvents="box-none">
          <Wordmark />
          <MapControls />
        </View>
        {demo.enabled ? (
          <View style={styles.demoRow} pointerEvents="none">
            <View style={[styles.demoChip, { backgroundColor: theme.accentSoft }]}>
              <Caps tone="accent" size={type.meta}>
                DEMO · LONG-PRESS MAP TO MOVE
              </Caps>
            </View>
          </View>
        ) : null}
        <View style={styles.header} pointerEvents="box-none">
          <Pressable
            onLongPress={() => setDemoEnabled(!demo.enabled)}
            accessibilityRole="button"
            accessibilityLabel={demo.enabled ? "Demo mode, on" : "Demo mode, off"}
            accessibilityHint="Long press to toggle demo mode"
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={styles.eyebrow}
          >
            <Text style={[styles.eyebrowText, { color: theme.ink2 }]}>
              {`NEAR ${(nearestLandmark?.name ?? FALLBACK_LANDMARK).toUpperCase()}`}
            </Text>
          </Pressable>
          <View pointerEvents="none">
            <Text style={[styles.headline, { color: theme.ink }]}>{voicesNearbyLabel(voicesNearby)}</Text>
          </View>
        </View>
      </View>

      <IconButton
        icon="locate"
        variant="surface"
        accessibilityLabel="Recenter map"
        disabled={!userPosition}
        onPress={() => {
          if (!userPosition) return;
          mapRef.current?.animateToRegion(
            { ...userPosition, latitudeDelta: 0.008, longitudeDelta: 0.01 },
            400,
          );
        }}
        style={[styles.recenter, { bottom: insets.bottom + space.sm + NAV_HEIGHT + space.md }]}
      />

      <View style={[styles.navWrap, { bottom: insets.bottom + space.sm }]} pointerEvents="box-none">
        <FloatingNav />
      </View>

      <VoiceCard
        note={selectedNote}
        distance={selectedDistance}
        onOpen={(note) => router.push(`/story/${note.id}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.gutter,
  },
  demoRow: {
    paddingHorizontal: space.gutter,
    marginTop: space.sm,
    alignItems: "flex-start",
  },
  demoChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  header: {
    paddingHorizontal: space.gutter,
    marginTop: space.sm,
    gap: space.xs,
  },
  eyebrow: {
    alignSelf: "flex-start",
  },
  eyebrowText: {
    ...textStyle.capsLarge,
  },
  headline: {
    ...textStyle.titleSerif,
  },
  recenter: {
    position: "absolute",
    right: space.gutter,
  },
  navWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  zoneLabel: {
    fontFamily: fonts.sansBold,
    fontSize: type.meta,
    letterSpacing: 1.4,
    textAlign: "center" },
});
