import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Caps } from "../../src/components/Caps";
import { IconButton } from "../../src/components/IconButton";
import { ListRow } from "../../src/components/ListRow";
import { NowPlayingBar } from "../../src/components/NowPlayingBar";
import { ReactionButton } from "../../src/components/ReactionButton";
import { Waveform } from "../../src/components/Waveform";
import { PinCluster, PinLabel, PinUnlocked, YouAreHere } from "../../src/NotePins";
import { SEED_NOTES } from "../../src/seedNotes";
import {
  fonts,
  getThemeOverride,
  palette,
  setThemeOverride,
  type ThemeMode,
  ThemeScope,
  useThemeMode,
} from "../../src/theme";

const NOTE = SEED_NOTES[0];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const mode = useThemeMode();
  const theme = palette[mode];
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.ink3 }]}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function Column({ mode, children }: { mode: ThemeMode; children: React.ReactNode }) {
  const theme = palette[mode];
  return (
    <ThemeScope mode={mode}>
      <View style={[styles.column, { backgroundColor: theme.bg, borderColor: theme.line }]}>
        <Caps tone="ink3">{mode.toUpperCase()}</Caps>
        {children}
      </View>
    </ThemeScope>
  );
}

function Samples() {
  const mode = useThemeMode();
  const theme = palette[mode];
  const [reaction, setReaction] = useState(false);
  return (
    <>
      <Section title="Type">
        <Caps tone="accent">NEAR NORTHROP MALL</Caps>
        <Text style={{ fontFamily: fonts.sans, fontSize: 17, color: theme.ink }}>Karla sans 17</Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 19, lineHeight: 27, color: theme.ink2 }}>
          Newsreader serif 19/27 — the quiet transcript voice.
        </Text>
      </Section>
      <Section title="Buttons">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <IconButton icon="arrow-back" accessibilityLabel="Back" />
          <IconButton icon="bookmark-outline" accessibilityLabel="Save" variant="tint" />
          <IconButton icon="locate" accessibilityLabel="Recenter" variant="glass" />
          <IconButton icon="mic" accessibilityLabel="Record" variant="solid" tone="onAccent" />
        </View>
        <ReactionButton label="I felt this too" selected={reaction} onPress={() => setReaction((value) => !value)} />
      </Section>
      <Section title="Waveform">
        <Waveform progress={0.4} seed={7} height={26} />
      </Section>
      <Section title="Pins">
        <PinLabel note={NOTE} distance={220} selected={false} onPress={() => {}} />
        <PinUnlocked note={NOTE} distance={90} selected={false} onPress={() => {}} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <PinCluster label="4 voices" />
          <YouAreHere />
        </View>
      </Section>
      <Section title="Now playing">
        <NowPlayingBar
          title={NOTE.title}
          timeLabel="0:48"
          progress={0.36}
          playing
          onPress={() => {}}
          onToggle={() => {}}
        />
      </Section>
      <Section title="List row">
        <ListRow
          eyebrow="THIS EVENING · WALTER LIBRARY"
          title={NOTE.title}
          accessibilityLabel={`Open ${NOTE.title}`}
        />
      </Section>
    </>
  );
}

export default function ThemeCheckScreen() {
  const globalMode = useThemeMode();
  const [forced, setForced] = useState<ThemeMode | null>(getThemeOverride());
  const choose = (choice: "system" | ThemeMode) => {
    const next = choice === "system" ? null : choice;
    setThemeOverride(next);
    setForced(next);
  };
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette[globalMode].bg }]}>
      <View style={styles.header}>
        <Caps tone="ink3">DEV · THEME CHECK</Caps>
        <View style={styles.toggleRow}>
          {(["system", "light", "dark"] as const).map((choice) => {
            const active = choice === "system" ? forced === null : forced === choice;
            return (
              <Text
                key={choice}
                accessibilityRole="button"
                accessibilityLabel={`Force ${choice} theme`}
                onPress={() => choose(choice)}
                style={[
                  styles.toggle,
                  {
                    fontFamily: active ? fonts.sansBold : fonts.sans,
                    color: palette[globalMode].ink2,
                    borderColor: palette[globalMode].line,
                  },
                ]}
              >
                {choice.toUpperCase()}
              </Text>
            );
          })}
        </View>
        <Text style={[styles.note, { color: palette[globalMode].ink3 }]}>
          Raw-hex audit: run `npm run audit:colors` — any hex outside theme.ts / mapStyle.ts fails.
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns}>
        <Column mode="light">
          <Samples />
        </Column>
        <Column mode="dark">
          <Samples />
        </Column>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: 24, gap: 10 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggle: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 12,
    letterSpacing: 0.8,
    overflow: "hidden",
  },
  note: { fontFamily: fonts.sans, fontSize: 12 },
  columns: { paddingHorizontal: 12, gap: 12, paddingBottom: 40 },
  column: {
    width: 250,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 18,
  },
  section: { gap: 8 },
  sectionTitle: { fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 0.8 },
});
