import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "../src/components/IconButton";
import { DEFAULT_CAMERA, USE_GOOGLE_ON_IOS } from "../src/config";
import { googleMapStyle } from "../src/mapStyle";
import { SEED_NOTES } from "../src/seedNotes";
import { fonts, fontWeight, motion, space, type, useTheme, useThemeMode } from "../src/theme";

const DRAWER_WIDTH = 320;
const MY_POSTS_COUNT = 2;

type DrawerItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta?: string;
  variant?: "primary" | "secondary";
  onPress: () => void;
  accessibilityLabel: string;
};

function DrawerItem({ icon, label, meta, variant = "primary", onPress, accessibilityLabel }: DrawerItemProps) {
  const theme = useTheme();
  const primary = variant === "primary";
  const color = primary ? theme.ink : theme.ink2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.navItem,
        primary ? styles.navItemPrimary : styles.navItemSecondary,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text numberOfLines={1} style={[styles.navLabel, { color }, primary ? styles.navLabelPrimary : styles.navLabelSecondary]}>
        {label}
      </Text>
      {meta ? <Text style={[styles.navMeta, { color: theme.ink3 }]}>{meta}</Text> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const mode = useThemeMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    const animation = Animated.timing(slide, {
      toValue: 0,
      duration: motion.settle,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [slide]);

  const scrimOpacity = slide.interpolate({
    inputRange: [-DRAWER_WIDTH, 0],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const useGoogle = Platform.OS === "android" || USE_GOOGLE_ON_IOS;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ presentation: "transparentModal", animation: "slide_from_left", headerShown: false }} />
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_CAMERA}
        provider={useGoogle && Platform.OS === "ios" ? PROVIDER_GOOGLE : undefined}
        mapType={useGoogle ? "standard" : "mutedStandard"}
        customMapStyle={useGoogle ? googleMapStyle(mode) : undefined}
        showsPointsOfInterests={!useGoogle}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        pointerEvents="none"
      />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim, opacity: scrimOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close profile"
        />
      </Animated.View>
      <Animated.View
        onStartShouldSetResponder={() => true}
        style={[
          styles.drawer,
          {
            backgroundColor: theme.glassStrong,
            borderRightColor: theme.glassStroke,
            shadowColor: theme.glassShadow,
            paddingTop: insets.top + space.lg,
            paddingBottom: insets.bottom + 6,
            transform: [{ translateX: slide }],
          },
        ]}
      >
        <View style={styles.top}>
          <View style={styles.header}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { backgroundColor: theme.accentSoft, borderColor: theme.accentLine }]}>
                <Ionicons name="stats-chart-outline" size={22} color={theme.accentText} />
              </View>
              <IconButton
                icon="close"
                variant="tint"
                size={44}
                iconSize={18}
                onPress={() => router.back()}
                accessibilityLabel="Close profile"
              />
            </View>
            <View style={styles.identity}>
              <Text style={[styles.title, { color: theme.ink }]}>Your SpeakEz</Text>
              <Text style={[styles.who, { color: theme.ink2 }]}>Anonymous student</Text>
              <View style={styles.verified}>
                <Ionicons name="checkmark-circle" size={15} color={theme.accentText} />
                <Text style={[styles.verifiedLabel, { color: theme.accentText }]}>UMN verified</Text>
              </View>
            </View>
          </View>
          <View>
            <DrawerItem icon="person-outline" label="Profile" onPress={() => {}} accessibilityLabel="Profile" />
            <DrawerItem
              icon="mic-outline"
              label="My Posts"
              meta={String(MY_POSTS_COUNT)}
              onPress={() => router.push("/my-posts")}
              accessibilityLabel={`My Posts, ${MY_POSTS_COUNT} live`}
            />
            <DrawerItem
              icon="bookmark-outline"
              label="Saved Audio"
              meta={String(SEED_NOTES.length)}
              onPress={() => router.push("/saved")}
              accessibilityLabel={`Saved Audio, ${SEED_NOTES.length} notes`}
            />
            <DrawerItem icon="headset-outline" label="Recently Heard" onPress={() => {}} accessibilityLabel="Recently Heard" />
            <DrawerItem
              icon="help-buoy-outline"
              label="Help & Resources"
              onPress={() => router.push("/care")}
              accessibilityLabel="Help and Resources"
            />
          </View>
        </View>
        <View>
          <DrawerItem
            icon="settings-outline"
            label="Settings"
            variant="secondary"
            onPress={() => {}}
            accessibilityLabel="Settings"
          />
          <DrawerItem
            icon="information-circle-outline"
            label="About SpeakEz"
            variant="secondary"
            onPress={() => {}}
            accessibilityLabel="About SpeakEz"
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    borderRightWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 1,
    shadowRadius: 32,
    shadowOffset: { width: 8, height: 0 },
    elevation: 8,
  },
  top: {
    gap: space.xl,
  },
  header: {
    gap: 12,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    gap: 4,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: type.title,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.7,
  },
  who: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.regular,
  },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  verifiedLabel: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.bold,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  navItemPrimary: {
    height: 52,
  },
  navItemSecondary: {
    height: 44,
  },
  navLabel: {
    flex: 1,
    fontFamily: fonts.sans,
    fontWeight: fontWeight.regular,
  },
  navLabelPrimary: {
    fontSize: type.heading,
  },
  navLabelSecondary: {
    fontSize: type.body,
  },
  navMeta: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.regular,
  },
  pressed: {
    opacity: 0.7,
  },
});
