import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "../src/components/IconButton";
import { fonts, motion, radius, space, textStyle, type, useReducedMotion, useTheme } from "../src/theme";

const DRAWER_WIDTH = 320;
/** Rows bleed into the gutter so the pressed tint spans edge to edge. */
const ROW_BLEED = 12;

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
        { backgroundColor: pressed ? theme.tint : theme.surfaceClear },
      ]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text numberOfLines={1} style={[primary ? styles.navLabelPrimary : styles.navLabelSecondary, { color }]}>
        {label}
      </Text>
      {meta ? <Text style={[styles.navMeta, { color: theme.ink3 }]}>{meta}</Text> : null}
    </Pressable>
  );
}

/**
 * Profile drawer. The route is a transparent modal (see app/_layout.tsx), so
 * the map stays visible underneath; this screen only draws the scrim and the
 * 320-wide drawer, slides it in on mount and slides it back out before popping.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const closing = useRef(false);

  useEffect(() => {
    const animation = Animated.timing(slide, {
      toValue: 0,
      duration: reduced ? 0 : motion.settle,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [slide, reduced]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(slide, {
      toValue: -DRAWER_WIDTH,
      duration: reduced ? 0 : motion.press,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) router.back();
      else closing.current = false;
    });
  }, [router, slide, reduced]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  function go(route: "/care" | "/qr") {
    if (closing.current) return;
    router.push(route);
  }

  const scrimOpacity = slide.interpolate({
    inputRange: [-DRAWER_WIDTH, 0],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim, opacity: scrimOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
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
            paddingBottom: insets.bottom + 40,
            transform: [{ translateX: slide }],
          },
        ]}
      >
        <View style={styles.top}>
          <View style={styles.header}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { backgroundColor: theme.accentSoft, borderColor: theme.accentLine }]}>
                <Ionicons name="pulse-outline" size={22} color={theme.accentText} />
              </View>
              <IconButton
                icon="close"
                variant="tint"
                size={44}
                iconSize={18}
                onPress={close}
                accessibilityLabel="Close profile"
              />
            </View>
            <View style={styles.identity}>
              <Text style={[styles.title, { color: theme.ink }]}>Your SpeakEz</Text>
              <Text style={[styles.who, { color: theme.ink2 }]}>Anonymous student</Text>
              <View style={styles.verified}>
                <Ionicons name="checkmark-circle-outline" size={15} color={theme.accentText} />
                <Text style={[styles.verifiedLabel, { color: theme.accentText }]}>UMN verified</Text>
              </View>
            </View>
          </View>
          <View>
            <DrawerItem icon="headset-outline" label="Recently Heard" onPress={() => {}} accessibilityLabel="Recently Heard" />
            <DrawerItem
              icon="help-buoy-outline"
              label="Help & Resources"
              onPress={() => go("/care")}
              accessibilityLabel="Help and Resources"
            />
            <DrawerItem
              icon="qr-code-outline"
              label="Open on another phone"
              onPress={() => go("/qr")}
              accessibilityLabel="Open on another phone"
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
    paddingHorizontal: space.gutter,
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
    ...textStyle.titleSans,
  },
  who: {
    ...textStyle.body,
  },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  verifiedLabel: {
    ...textStyle.supportStrong,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginHorizontal: -ROW_BLEED,
    paddingHorizontal: ROW_BLEED,
    borderRadius: radius.md,
  },
  navItemPrimary: {
    height: 52,
  },
  navItemSecondary: {
    height: 44,
  },
  navLabelPrimary: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.heading,
    lineHeight: 22,
  },
  navLabelSecondary: {
    flex: 1,
    ...textStyle.body,
  },
  navMeta: {
    ...textStyle.body,
  },
});
