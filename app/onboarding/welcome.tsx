import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Circle } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingButton } from "../../src/components/OnboardingButton";
import { OnboardingDots } from "../../src/components/OnboardingDots";
import { OnboardingFade } from "../../src/components/OnboardingFade";
import { OnboardingMap } from "../../src/components/OnboardingMap";
import { CAMPUS_CENTER, DEFAULT_CAMERA, UNLOCK_RADIUS_M } from "../../src/config";
import { pressed, space, textStyle, useTheme } from "../../src/theme";

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.hero}>
        <OnboardingMap initialRegion={DEFAULT_CAMERA} style={StyleSheet.absoluteFill}>
          <Circle
            center={CAMPUS_CENTER}
            radius={UNLOCK_RADIUS_M}
            fillColor={theme.accentWash}
            strokeColor={theme.accentLine}
            strokeWidth={1}
          />
        </OnboardingMap>
        <OnboardingFade edge="top" height={130} />
        <OnboardingFade edge="bottom" height={130} />
      </View>
      <View style={[styles.content, { paddingBottom: insets.bottom + space.md }]}>
        <Text accessibilityRole="header" style={[styles.wordmark, { color: theme.ink }]}>
          speakez
        </Text>
        <Text style={[styles.headline, { color: theme.ink }]}>
          Hear what campus doesn&apos;t say out loud.
        </Text>
        <Text style={[styles.body, { color: theme.ink2 }]}>
          Anonymous voice notes, left at the places they happened. Walk close to listen.
        </Text>
        <View style={styles.footer}>
          <OnboardingDots active={0} />
          <OnboardingButton label="Get started" onPress={() => router.push("/onboarding/location")} />
          <Pressable
            onPress={() => router.push("/(auth)/sign-in")}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            style={({ pressed: isPressed }) => [styles.signInRow, { opacity: isPressed ? pressed.dim : 1 }]}
          >
            <Text style={[styles.signInLead, { color: theme.ink2 }]}>Been here before?</Text>
            <Text style={[styles.signInLink, { color: theme.ink }]}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hero: {
    height: 440,
    minHeight: 240,
    flexShrink: 1,
    overflow: "hidden",
  },
  content: {
    flexGrow: 1,
    paddingTop: space.xs,
    paddingHorizontal: space.gutter,
    gap: space.md,
  },
  wordmark: {
    ...textStyle.wordmark,
    lineHeight: 32,
  },
  headline: {
    ...textStyle.displaySerif,
  },
  body: {
    ...textStyle.body,
  },
  footer: {
    marginTop: "auto",
    width: "100%",
    alignItems: "center",
    gap: space.md,
  },
  signInRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  signInLead: {
    ...textStyle.body,
  },
  signInLink: {
    ...textStyle.bodyStrong,
  },
});
