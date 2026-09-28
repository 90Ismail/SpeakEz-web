import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import type { CampusLandmark } from "../campusLandmarks";
import { UNLOCK_RADIUS_M, USE_GOOGLE_ON_IOS } from "../config";
import { googleMapStyle } from "../mapStyle";
import { fonts, fontWeight, radius, space, type, useTheme, useThemeMode } from "../theme";
import type { CampusZone } from "../zones";
import { IconButton } from "./IconButton";

export type PlaceChoice = "spot" | "campus";

type RecordPlaceStageProps = {
  zone: CampusZone | null;
  spotLandmark: CampusLandmark;
  campusLandmark: CampusLandmark;
  choice: PlaceChoice;
  onChangeChoice: (choice: PlaceChoice) => void;
  onBack: () => void;
  onContinue: () => void;
  topInset: number;
  bottomInset: number;
};

const FADE_BANDS = [0.88, 0.62, 0.38, 0.18, 0.06];
const MAP_HEIGHT = Math.min(420, Math.max(240, Math.round(Dimensions.get("window").height - 424)));

function TopFade({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={styles.fade}>
      {FADE_BANDS.map((opacity, index) => (
        <View key={index} style={{ flex: 1, backgroundColor: color, opacity }} />
      ))}
    </View>
  );
}

type PlaceOptionProps = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
};

function PlaceOption({ title, description, icon, selected, onPress }: PlaceOptionProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [
        styles.option,
        {
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? theme.ink : theme.controlLine,
          backgroundColor: selected ? theme.bg : theme.surfaceClear,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: selected ? theme.accentSoft : theme.tint },
        ]}
      >
        <Ionicons name={icon} size={16} color={selected ? theme.accent : theme.ink2} />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, { color: theme.ink }]}>{title}</Text>
        <Text style={[styles.optionDesc, { color: theme.ink2 }]}>{description}</Text>
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: selected ? theme.ink : theme.controlLine },
        ]}
      >
        {selected ? <View style={[styles.radioDot, { backgroundColor: theme.ink }]} /> : null}
      </View>
    </Pressable>
  );
}

export function RecordPlaceStage({
  zone,
  spotLandmark,
  campusLandmark,
  choice,
  onChangeChoice,
  onBack,
  onContinue,
  topInset,
  bottomInset,
}: RecordPlaceStageProps) {
  const theme = useTheme();
  const mode = useThemeMode();
  const mapRef = useRef<MapView | null>(null);
  const chosen = choice === "campus" ? campusLandmark : spotLandmark;

  useEffect(() => {
    mapRef.current?.animateToRegion(
      {
        latitude: chosen.coordinate.latitude,
        longitude: chosen.coordinate.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      350,
    );
  }, [chosen.id]);

  const bankName = zone ? (zone.id === "east" ? "the East Bank" : "the West Bank") : "campus";
  const useGoogle = Platform.OS === "android" || USE_GOOGLE_ON_IOS;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <MapView
        ref={mapRef}
        style={[styles.map, { height: MAP_HEIGHT }]}
        pointerEvents="none"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        mapType={useGoogle ? "standard" : "mutedStandard"}
        customMapStyle={useGoogle ? googleMapStyle(mode) : undefined}
        initialRegion={{
          latitude: spotLandmark.coordinate.latitude,
          longitude: spotLandmark.coordinate.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {zone ? (
          <Circle
            center={zone.center}
            radius={zone.radiusM}
            fillColor={theme.accentWash}
            strokeColor={theme.accentLine}
            strokeWidth={1}
          />
        ) : null}
        <Circle
          center={chosen.coordinate}
          radius={UNLOCK_RADIUS_M}
          fillColor={theme.accentWash}
          strokeColor={theme.accentLine}
          strokeWidth={1}
        />
        {zone ? (
          <Marker
            coordinate={zone.center}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={Platform.OS === "android"}
          >
            <Text style={[styles.zoneLabel, { color: theme.mapLabel }]}>{zone.label}</Text>
          </Marker>
        ) : null}
        <Marker
          key={chosen.id}
          coordinate={chosen.coordinate}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={Platform.OS === "android"}
        >
          <View style={styles.pin}>
            <View
              style={[styles.pinDot, { backgroundColor: theme.accent, borderColor: theme.ring }]}
            />
            <View style={[styles.pinChip, { backgroundColor: theme.ink }]}>
              <Ionicons name="pulse" size={13} color={theme.accent} />
              <Text style={[styles.pinLabel, { color: theme.surface }]} numberOfLines={1}>
                {chosen.name}
              </Text>
            </View>
          </View>
        </Marker>
      </MapView>

      <TopFade color={theme.bg} />

      <IconButton
        icon="arrow-back"
        accessibilityLabel="Back to recording"
        onPress={onBack}
        variant="glass"
        size={44}
        iconSize={19}
        style={[styles.back, { top: topInset + space.sm }]}
      />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.line,
            shadowColor: theme.glassShadow,
            paddingBottom: bottomInset + space.lg,
          },
        ]}
      >
        <Text style={[styles.heading, { color: theme.ink }]}>Where should this note live?</Text>
        <PlaceOption
          title="This spot"
          description={`Heard within ${UNLOCK_RADIUS_M} m of ${spotLandmark.name}.`}
          icon="location"
          selected={choice === "spot"}
          onPress={() => onChangeChoice("spot")}
        />
        <PlaceOption
          title="Campus"
          description={`Heard anywhere on ${bankName}.`}
          icon="map"
          selected={choice === "campus"}
          onPress={() => onChangeChoice("campus")}
        />
        <View style={styles.spacer} />
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel={`Continue with ${chosen.name}`}
          style={({ pressed }) => [
            styles.continue,
            { backgroundColor: theme.ink, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.continueLabel, { color: theme.surface }]}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    width: "100%",
  },
  fade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 130,
  },
  back: {
    position: "absolute",
    left: space.gutter,
    zIndex: 10,
  },
  zoneLabel: {
    fontFamily: fonts.sans,
    fontSize: type.meta,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.4,
  },
  pin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  pinChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius.xs,
  },
  pinLabel: {
    maxWidth: 190,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    fontWeight: fontWeight.bold,
  },
  sheet: {
    flex: 1,
    gap: 12,
    paddingTop: space.xl,
    paddingHorizontal: space.gutter,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  heading: {
    fontFamily: fonts.sans,
    fontSize: type.title,
    lineHeight: type.title * 1.1,
    letterSpacing: -0.7,
    fontWeight: fontWeight.bold,
    marginBottom: space.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: radius.sm,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    gap: space.xs,
  },
  optionTitle: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.bold,
  },
  optionDesc: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    lineHeight: type.support * 1.45,
    fontWeight: fontWeight.regular,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  spacer: {
    flex: 1,
  },
  continue: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  continueLabel: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.bold,
  },
});
