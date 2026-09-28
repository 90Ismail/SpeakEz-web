import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { landmarkById } from "./campusLandmarks";
import { CHIP_RADIUS_M, UNLOCK_RADIUS_M } from "./config";
import { formatDistance, formatDistanceUpper, type LatLng } from "./geo";
import type { SeedNote } from "./seedNotes";
import { fonts, fontWeight, radius, type, useTheme } from "./theme";

export type PinState = "dot" | "label" | "unlocked";

export type MarkerGeometry = {
  anchor: { x: number; y: number };
  centerOffset: { x: number; y: number };
};

const PIN_HEIGHT = 44;
const HALO_SIZE = 45;

const LABEL_LEFT_PAD = 12;
const LABEL_DOT_BOX = 18;
const LABEL_GAP = 6;
const LABEL_CHIP_MAX = 200;
const LABEL_WIDTH = LABEL_LEFT_PAD + LABEL_DOT_BOX + LABEL_GAP + LABEL_CHIP_MAX;
const LABEL_DOT_CENTER = LABEL_LEFT_PAD + LABEL_DOT_BOX / 2;

const UNLOCKED_LEFT_PAD = 12;
const UNLOCKED_DOT_BOX = 20;
const UNLOCKED_GAP = 7;
const UNLOCKED_CHIP_MAX = 290;
const UNLOCKED_WIDTH = UNLOCKED_LEFT_PAD + UNLOCKED_DOT_BOX + UNLOCKED_GAP + UNLOCKED_CHIP_MAX;
const UNLOCKED_DOT_CENTER = UNLOCKED_LEFT_PAD + UNLOCKED_DOT_BOX / 2;

export type Cluster = {
  id: string;
  label: string;
  coordinate: LatLng;
};

export const CLUSTERS: Cluster[] = [
  { id: "cluster-east", label: "4 voices", coordinate: { latitude: 44.9755, longitude: -93.2303 } },
  { id: "cluster-river", label: "3 voices", coordinate: { latitude: 44.9718, longitude: -93.2372 } },
];

export function pinStateFor(distanceM: number | null): PinState {
  if (distanceM === null) return "dot";
  if (distanceM <= UNLOCK_RADIUS_M) return "unlocked";
  if (distanceM <= CHIP_RADIUS_M) return "label";
  return "dot";
}

function dotGeometry(width: number, dotCenterX: number): MarkerGeometry {
  return {
    anchor: { x: dotCenterX / width, y: 0.5 },
    centerOffset: { x: width / 2 - dotCenterX, y: 0 },
  };
}

export function pinMarkerGeometry(state: PinState): MarkerGeometry {
  if (state === "label") return dotGeometry(LABEL_WIDTH, LABEL_DOT_CENTER);
  if (state === "unlocked") return dotGeometry(UNLOCKED_WIDTH, UNLOCKED_DOT_CENTER);
  return { anchor: { x: 0.5, y: 0.5 }, centerOffset: { x: 0, y: 0 } };
}

function pinAccessibilityLabel(note: SeedNote, distance: number | null): string {
  const landmark = landmarkById(note.landmarkId);
  const parts = [note.title];
  if (landmark) parts.push(landmark.name);
  if (distance !== null) parts.push(`${formatDistance(distance)} away`);
  return parts.join(" · ");
}

type DotProps = {
  size: number;
  ring: number;
  color: string;
  ringColor: string;
};

function Dot({ size, ring, color, ringColor }: DotProps) {
  const box = size + ring * 2;
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: box / 2,
        backgroundColor: color,
        borderWidth: ring,
        borderColor: ringColor,
      }}
    />
  );
}

type PinShellProps = {
  width: number;
  height?: number;
  dotCenterX: number;
  selected?: boolean;
  children: ReactNode;
};

function PinShell({ width, height = PIN_HEIGHT, dotCenterX, selected, children }: PinShellProps) {
  const theme = useTheme();
  return (
    <View style={{ width, height, justifyContent: "center" }}>
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: dotCenterX - HALO_SIZE / 2,
            top: (height - HALO_SIZE) / 2,
            width: HALO_SIZE,
            height: HALO_SIZE,
            borderRadius: HALO_SIZE / 2,
            backgroundColor: theme.accentWash,
            borderWidth: 1,
            borderColor: theme.accentLine,
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

type NotePinProps = {
  note: SeedNote;
  distance: number | null;
  selected: boolean;
  onPress: () => void;
};

export function NotePin({ note, distance, selected, onPress }: NotePinProps) {
  const state = pinStateFor(distance);
  if (state === "unlocked") {
    return <PinUnlocked note={note} distance={distance} selected={selected} onPress={onPress} />;
  }
  if (state === "label") {
    return <PinLabel note={note} distance={distance} selected={selected} onPress={onPress} />;
  }
  return <PinDot note={note} distance={distance} selected={selected} onPress={onPress} />;
}

export function PinDot({ note, distance, selected, onPress }: NotePinProps) {
  const theme = useTheme();
  return (
    <PinShell width={PIN_HEIGHT} dotCenterX={PIN_HEIGHT / 2} selected={selected}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={pinAccessibilityLabel(note, distance)}
        style={styles.dotPressable}
      >
        <Dot size={selected ? 15 : 10} ring={selected ? 2.5 : 2} color={theme.accent} ringColor={theme.ring} />
      </Pressable>
    </PinShell>
  );
}

export function PinLabel({ note, distance, selected, onPress }: NotePinProps) {
  const theme = useTheme();
  return (
    <PinShell width={LABEL_WIDTH} dotCenterX={LABEL_DOT_CENTER} selected={selected}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={pinAccessibilityLabel(note, distance)}
        style={[styles.pinRow, { height: PIN_HEIGHT, paddingLeft: LABEL_LEFT_PAD, gap: LABEL_GAP }]}
      >
        <View style={[styles.dotBox, { width: LABEL_DOT_BOX }]}>
          <Dot size={selected ? 15 : 12} ring={2.5} color={theme.accent} ringColor={theme.ring} />
        </View>
        <View
          style={[
            styles.chip,
            {
              maxWidth: LABEL_CHIP_MAX,
              backgroundColor: selected ? theme.ink : theme.glassStrong,
              borderColor: selected ? theme.ink : theme.glassStroke,
              borderRadius: selected ? 7.5 : radius.xs,
              paddingTop: selected ? 7.5 : 6,
              paddingRight: selected ? 12.5 : 10,
              paddingBottom: selected ? 7.5 : 6,
              paddingLeft: selected ? 10 : 8,
              gap: selected ? 7.5 : 6,
            },
          ]}
        >
          <Ionicons name="mic-outline" size={selected ? 16 : 13} color={selected ? theme.accent : theme.ink3} />
          <Text
            numberOfLines={1}
            style={[
              styles.chipTitle,
              {
                color: selected ? theme.surface : theme.ink2,
                fontSize: selected ? type.body : type.support,
                fontWeight: selected ? fontWeight.bold : fontWeight.semibold,
              },
            ]}
          >
            {note.title}
          </Text>
        </View>
      </Pressable>
    </PinShell>
  );
}

export function PinUnlocked({ note, distance, selected, onPress }: NotePinProps) {
  const theme = useTheme();
  const distanceLabel = distance === null ? "UNLOCKED" : `UNLOCKED · ${formatDistanceUpper(distance)}`;
  return (
    <PinShell width={UNLOCKED_WIDTH} dotCenterX={UNLOCKED_DOT_CENTER} selected={selected}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={pinAccessibilityLabel(note, distance)}
        accessibilityHint="Unlocked · tap to open"
        style={[styles.pinRow, { height: PIN_HEIGHT, paddingLeft: UNLOCKED_LEFT_PAD, gap: UNLOCKED_GAP }]}
      >
        <View style={[styles.dotBox, { width: UNLOCKED_DOT_BOX }]}>
          <Dot size={selected ? 15 : 14} ring={2.5} color={theme.accent} ringColor={theme.ring} />
        </View>
        <View
          style={[
            styles.chip,
            {
              maxWidth: UNLOCKED_CHIP_MAX,
              backgroundColor: selected ? theme.ink : theme.accentSoft,
              borderColor: selected ? theme.ink : theme.accent,
              borderRadius: selected ? 7.5 : radius.xs,
              borderWidth: selected ? 1 : 1.5,
              paddingTop: selected ? 7.5 : 8,
              paddingRight: selected ? 12.5 : 12,
              paddingBottom: selected ? 7.5 : 8,
              paddingLeft: selected ? 10 : 10,
              gap: 7,
              shadowColor: theme.glassShadow,
            },
          ]}
        >
          <Ionicons
            name="lock-open-outline"
            size={selected ? 16 : 14}
            color={selected ? theme.accent : theme.accentText}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.unlockedCaption,
              { color: selected ? theme.accent : theme.accentText },
            ]}
          >
            {distanceLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.chipTitle,
              {
                flexShrink: 1,
                color: selected ? theme.surface : theme.ink,
                fontSize: selected ? type.body : type.support,
                fontWeight: fontWeight.bold,
              },
            ]}
          >
            {note.title}
          </Text>
        </View>
      </Pressable>
    </PinShell>
  );
}

export function PinCluster({ label }: { label: string }) {
  const theme = useTheme();
  const dotColors = [theme.accent, theme.accent, theme.accentLine];
  return (
    <View
      style={[
        styles.cluster,
        { backgroundColor: theme.glassStrong, borderColor: theme.glassStroke, shadowColor: theme.glassShadow },
      ]}
    >
      <View style={styles.clusterDots}>
        {dotColors.map((color, index) => (
          <View key={index} style={{ marginLeft: index === 0 ? 0 : -3 }}>
            <Dot size={7} ring={1.5} color={color} ringColor={theme.surface} />
          </View>
        ))}
      </View>
      <Text style={[styles.clusterLabel, { color: theme.ink2 }]}>{label}</Text>
    </View>
  );
}

export function YouAreHere() {
  const theme = useTheme();
  return (
    <View style={[styles.youAreHere, { backgroundColor: theme.tint }]}>
      <Dot size={12} ring={3} color={theme.ink} ringColor={theme.ring} />
    </View>
  );
}

const styles = StyleSheet.create({
  dotPressable: {
    width: PIN_HEIGHT,
    height: PIN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  pinRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dotBox: {
    width: LABEL_DOT_BOX,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  chipTitle: {
    fontFamily: fonts.sans,
    flexShrink: 1,
  },
  unlockedCaption: {
    fontFamily: fonts.sans,
    fontSize: type.meta,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: 9,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  clusterDots: {
    flexDirection: "row",
    alignItems: "center",
  },
  clusterLabel: {
    fontFamily: fonts.sans,
    fontSize: type.meta,
    fontWeight: fontWeight.regular,
  },
  youAreHere: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
