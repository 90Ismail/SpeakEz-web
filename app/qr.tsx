import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "../src/components/TopBar";
import { DEMO_URL } from "../src/config";
import { radius, space, textStyle, useTheme } from "../src/theme";

// qrcode-generator is pure JS (no canvas, no native module), so the matrix can
// be drawn as plain Views and works in Expo Go.
import qrcode from "qrcode-generator";

const QUIET_ZONE = 4;
const MAX_QR_SIZE = 280;

function buildMatrix(payload: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  const count = qr.getModuleCount();
  const total = count + QUIET_ZONE * 2;
  const grid: boolean[][] = [];
  for (let row = 0; row < total; row += 1) {
    const cells: boolean[] = [];
    for (let col = 0; col < total; col += 1) {
      const moduleRow = row - QUIET_ZONE;
      const moduleCol = col - QUIET_ZONE;
      const inside =
        moduleRow >= 0 && moduleCol >= 0 && moduleRow < count && moduleCol < count;
      cells.push(inside && qr.isDark(moduleRow, moduleCol));
    }
    grid.push(cells);
  }
  return grid;
}

/** A presenter screen: judges scan this to open the demo on their own phone. */
export default function QrScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // EXPO_PUBLIC_DEMO_URL wins (a hosted web build); otherwise a deep link into
  // this running app, which opens Expo Go.
  const payload = useMemo(() => DEMO_URL || Linking.createURL("/"), []);
  const matrix = useMemo(() => buildMatrix(payload), [payload]);

  const qrSize = Math.min(width - space.gutter * 2, MAX_QR_SIZE);
  const cell = qrSize / matrix.length;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <TopBar
        title="Open on another phone"
        leading={{ icon: "close", label: "Close", onPress: () => router.back() }}
      />
      <View style={styles.content}>
        <Text style={[styles.headline, { color: theme.ink }]}>Scan to try SpeakEz</Text>
        <Text style={[styles.sub, { color: theme.ink2 }]}>
          Point your camera at the code, then long-press the map near a landmark to unlock a note.
        </Text>

        <View style={[styles.qrFrame, { backgroundColor: theme.qrLight, borderColor: theme.line }]}>
          <View style={{ width: qrSize, height: qrSize }}>
            {matrix.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.qrRow}>
                {row.map((dark, colIndex) => (
                  <View
                    key={colIndex}
                    style={{
                      width: cell,
                      height: cell,
                      backgroundColor: dark ? theme.qrDark : theme.qrLight,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.linkRow}>
          <Ionicons name="link-outline" size={15} color={theme.ink3} />
          <Text numberOfLines={1} style={[styles.link, { color: theme.ink3 }]}>
            {payload}
          </Text>
        </View>

        <Text style={[styles.hint, { color: theme.ink3 }]}>
          {DEMO_URL
            ? "Set with EXPO_PUBLIC_DEMO_URL."
            : "Set EXPO_PUBLIC_DEMO_URL to the landing page so judges get the Expo Go handoff."}
        </Text>

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={({ pressed }) => [
            styles.done,
            { borderColor: theme.controlLine, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.doneLabel, { color: theme.ink }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: space.gutter,
    paddingTop: space.xl,
    gap: space.md,
  },
  headline: {
    ...textStyle.titleSerif,
    textAlign: "center",
  },
  sub: {
    ...textStyle.body,
    textAlign: "center",
  },
  qrFrame: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.sm,
  },
  qrRow: {
    flexDirection: "row",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  link: {
    ...textStyle.support,
    flexShrink: 1,
  },
  hint: {
    ...textStyle.support,
    textAlign: "center",
  },
  done: {
    marginTop: space.sm,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  doneLabel: {
    ...textStyle.supportStrong,
  },
});
