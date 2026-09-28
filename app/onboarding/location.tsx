import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Circle } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingButton, OnboardingTextButton } from "../../src/components/OnboardingButton";
import { OnboardingDots } from "../../src/components/OnboardingDots";
import { OnboardingMap } from "../../src/components/OnboardingMap";
import { setLocationChoice, type LocationChoice } from "../../src/components/OnboardingPrefs";
import { TopBar } from "../../src/components/TopBar";
import { CAMPUS_CENTER, UNLOCK_RADIUS_M } from "../../src/config";
import { fonts, radius, space, textStyle, useTheme } from "../../src/theme";

const MAP_WINDOW_HEIGHT = 230;
const RADIUS_DIAMETER_PT = 170;
const METERS_PER_LAT_DEGREE = 111320;

const ASSURANCES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "eye-off-outline", label: "Only while you're using the app." },
  { icon: "shield-outline", label: "Never stored or shared." },
  { icon: "locate-outline", label: "Approximate location still works." },
];

export default function OnboardingLocationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const mapWindowWidth = width - space.gutter * 2;
  const metersPerPoint = UNLOCK_RADIUS_M / (RADIUS_DIAMETER_PT / 2);
  const mapWindowRegion = {
    ...CAMPUS_CENTER,
    latitudeDelta: (MAP_WINDOW_HEIGHT * metersPerPoint) / METERS_PER_LAT_DEGREE,
    longitudeDelta:
      (mapWindowWidth * metersPerPoint) /
      (METERS_PER_LAT_DEGREE * Math.cos((CAMPUS_CENTER.latitude * Math.PI) / 180)),
  };

  const goToSignIn = () => {
    router.push("/(auth)/sign-in");
  };

  const handleAllow = async () => {
    let choice: LocationChoice = "denied";
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      choice = status === "granted" ? "granted" : "denied";
    } catch {
      choice = "denied";
    }
    setLocationChoice(choice);
    goToSignIn();
  };

  const handleNotNow = () => {
    setLocationChoice("skipped");
    goToSignIn();
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <TopBar
        leading={{ label: "Go back", onPress: () => router.back() }}
        trailing={<OnboardingDots active={1} />}
      />
      <View style={[styles.mapWindow, { backgroundColor: theme.mapGround, borderColor: theme.line }]}>
        <OnboardingMap initialRegion={mapWindowRegion} style={StyleSheet.absoluteFill}>
          <Circle
            center={CAMPUS_CENTER}
            radius={UNLOCK_RADIUS_M}
            fillColor={theme.accentWash}
            strokeColor={theme.accentLine}
            strokeWidth={1.5}
          />
        </OnboardingMap>
        <View pointerEvents="none" style={styles.centreDotWrap}>
          <View style={[styles.centreDot, { backgroundColor: theme.tint }]}>
            <View style={[styles.centreDotCore, { backgroundColor: theme.ink, borderColor: theme.ring }]} />
          </View>
        </View>
        <View
          pointerEvents="none"
          style={[styles.lockedChip, { backgroundColor: theme.glassStrong, borderColor: theme.glassStroke }]}
        >
          <Ionicons name="lock-closed-outline" size={11} color={theme.ink2} />
          <Text style={[styles.chipText, { color: theme.ink2 }]}>320 m away</Text>
        </View>
        <View pointerEvents="none" style={styles.radiusLabelWrap}>
          <View style={[styles.radiusLabel, { backgroundColor: theme.accent }]}>
            <Text style={[styles.chipText, { color: theme.onAccent }]}>150 m</Text>
          </View>
        </View>
      </View>
      <View style={[styles.content, { paddingBottom: insets.bottom + space.md }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>
          Notes unlock when you&apos;re close.
        </Text>
        <Text style={[styles.body, { color: theme.ink2 }]}>
          We use your location while the app is open to show which notes you can hear.
        </Text>
        <View style={styles.assurances}>
          {ASSURANCES.map((assurance) => (
            <View key={assurance.icon} style={styles.assurance}>
              <Ionicons name={assurance.icon} size={18} color={theme.ink2} />
              <Text style={[styles.assuranceLabel, { color: theme.ink }]}>{assurance.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <OnboardingButton
            label="Allow location"
            icon="location-outline"
            onPress={handleAllow}
            accessibilityHint="Opens the system location prompt, then continues to sign in"
          />
          <OnboardingTextButton label="Not now" onPress={handleNotNow} />
          <Text style={[styles.systemNote, { color: theme.ink3 }]}>
            Your phone will ask you to confirm next.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  mapWindow: {
    marginTop: space.sm,
    marginHorizontal: space.gutter,
    height: MAP_WINDOW_HEIGHT,
    minHeight: 170,
    flexShrink: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  centreDotWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centreDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  centreDotCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
  },
  lockedChip: {
    position: "absolute",
    right: 6,
    bottom: 47,
    height: 23,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  radiusLabelWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
  },
  radiusLabel: {
    height: 19,
    justifyContent: "center",
    paddingHorizontal: space.sm,
    borderRadius: 9,
  },
  chipText: {
    ...textStyle.meta,
    fontFamily: fonts.sansBold,
  },
  content: {
    flexGrow: 1,
    paddingTop: 28,
    paddingHorizontal: space.gutter,
    gap: 14,
  },
  heading: {
    ...textStyle.displaySans,
  },
  body: {
    ...textStyle.body,
  },
  assurances: {
    gap: 12,
  },
  assurance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  assuranceLabel: {
    ...textStyle.body,
  },
  footer: {
    marginTop: "auto",
    width: "100%",
    alignItems: "center",
    gap: 14,
  },
  systemNote: {
    ...textStyle.support,
    textAlign: "center",
  },
});
