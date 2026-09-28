import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { landmarkById } from "../src/campusLandmarks";
import { FloatingNav, NAV_HEIGHT } from "../src/components/FloatingNav";
import { formatDuration, ListRow, ListRowMore } from "../src/components/ListRow";
import { TopBar } from "../src/components/TopBar";
import { NOTE_KIND_ORDER, NOTE_KINDS, type NoteKind } from "../src/noteKinds";
import { seedNoteById } from "../src/seedNotes";
import { pressed as pressedOpacity, space, textStyle, useTheme } from "../src/theme";

type IoniconName = keyof typeof Ionicons.glyphMap;

const PUBLIC_POSTS: { id: string; fades: string }[] = [
  { id: "failing-first-semester", fades: "Fades in 27 days" },
  { id: "tired-at-walter", fades: "Fades in 22 days" },
];

const JOURNAL_ENTRIES = [
  {
    eyebrow: "SEPT 21",
    title: "Things I'm not ready to say yet",
    duration: "1:48",
    rest: "·  Only you",
  },
];

const DRAFTS = [
  {
    eyebrow: "SEPT 25",
    title: "Something I want to tell my brother",
    duration: "1:06",
    rest: "·  Not finished",
  },
];

const FADED_COUNT = 3;

type SectionHeadProps = {
  kind: NoteKind;
  count: number;
};

function SectionHead({ kind, count }: SectionHeadProps) {
  const theme = useTheme();
  const info = NOTE_KINDS[kind];
  const disc =
    kind === "public"
      ? { backgroundColor: theme.accentSoft, color: theme.accentText }
      : { backgroundColor: theme.tint, color: kind === "draft" ? theme.ink2 : theme.ink };
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${info.section}, ${info.summary}, ${count}`}
      style={styles.sectionHead}
    >
      <View style={[styles.sectionDisc, { backgroundColor: disc.backgroundColor }]}>
        <Ionicons name={info.icon} size={16} color={disc.color} />
      </View>
      <View style={styles.sectionText}>
        <Text style={[styles.sectionName, { color: theme.ink }]}>{info.section}</Text>
        <Text style={[styles.sectionDesc, { color: theme.ink3 }]}>{info.summary}</Text>
      </View>
      <Text style={[styles.sectionCount, { color: theme.ink3 }]}>{count}</Text>
    </View>
  );
}

function EmptyRow({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { borderTopColor: theme.line }]}>
      <Text style={[styles.emptyLabel, { color: theme.ink3 }]}>{label}</Text>
    </View>
  );
}

type ListenRowProps = {
  duration: string;
  rest: string;
  onPress: () => void;
  accessibilityLabel: string;
};

function ListenRow({ duration, rest, onPress, accessibilityLabel }: ListenRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.listenRow}>
      <Pressable
        onPress={onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.playCircle,
          { borderColor: theme.controlLine, opacity: pressed ? pressedOpacity.dim : 1 },
        ]}
      >
        <Ionicons name="play" size={13} color={theme.ink} />
      </Pressable>
      <Text style={[styles.listenDuration, { color: theme.ink }]}>{duration}</Text>
      <Text style={[styles.listenRest, { color: theme.ink2 }]}>{rest}</Text>
    </View>
  );
}

type PillProps = {
  icon: IoniconName;
  label: string;
  tone: "ink" | "outlined";
  onPress: () => void;
  accessibilityLabel: string;
};

function Pill({ icon, label, tone, onPress, accessibilityLabel }: PillProps) {
  const theme = useTheme();
  const filled = tone === "ink";
  const color = filled ? theme.surface : theme.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.pill,
        filled
          ? { backgroundColor: theme.ink }
          : { backgroundColor: theme.surfaceClear, borderWidth: 1, borderColor: theme.controlLine },
        { opacity: pressed ? pressedOpacity.soft : 1 },
      ]}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function List({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }}>{children}</View>;
}

export default function JournalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navBottom = insets.bottom + 4;

  const sections: Record<NoteKind, { count: number; body: ReactNode }> = {
    public: {
      count: PUBLIC_POSTS.length,
      body: (
        <>
          <List>
            {PUBLIC_POSTS.map(({ id, fades }) => {
              const note = seedNoteById(id);
              if (!note) return null;
              const landmarkName = landmarkById(note.landmarkId)?.name ?? "Campus";
              return (
                <ListRow
                  key={note.id}
                  eyebrowIcon={NOTE_KINDS.public.icon}
                  eyebrow={`${note.dayLabel.toUpperCase()} · ${landmarkName.toUpperCase()}`}
                  eyebrowTone="ink3"
                  title={note.title}
                  contentGap={4}
                  paddingVertical={20}
                  rowGap={8}
                  onPress={() => router.push(`/story/${note.id}`)}
                  accessibilityLabel={`Open ${note.title} at ${landmarkName}`}
                  trailing={
                    <ListRowMore
                      onPress={() => {}}
                      accessibilityLabel={`More options for ${note.title}`}
                      style={styles.rowTrailing}
                    />
                  }
                >
                  <ListenRow
                    duration={formatDuration(note.durationSec)}
                    rest={`·  ${fades}`}
                    onPress={() => router.push(`/story/${note.id}`)}
                    accessibilityLabel={`Play ${note.title}`}
                  />
                  <View style={styles.stateRow}>
                    <Pressable
                      onPress={() => {}}
                      accessibilityRole="button"
                      accessibilityLabel={`Read quiet responses to ${note.title}`}
                      style={({ pressed }) => [styles.responsesLink, { opacity: pressed ? pressedOpacity.dim : 1 }]}
                    >
                      <Ionicons name="heart-outline" size={14} color={theme.ink2} />
                      <Text style={[styles.responsesLabel, { color: theme.ink2 }]}>Read quiet responses</Text>
                    </Pressable>
                  </View>
                </ListRow>
              );
            })}
          </List>
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${FADED_COUNT} earlier posts have faded`}
            style={[styles.fadedRow, { borderTopColor: theme.line }]}
          >
            <Ionicons name="archive-outline" size={18} color={theme.ink2} />
            <Text style={[styles.fadedLabel, { color: theme.ink2 }]}>{FADED_COUNT} earlier posts have faded</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.ink2} />
          </View>
        </>
      ),
    },
    journal: {
      count: JOURNAL_ENTRIES.length,
      body:
        JOURNAL_ENTRIES.length === 0 ? (
          <EmptyRow label="Nothing here yet. Private recordings land here." />
        ) : (
          <List>
            {JOURNAL_ENTRIES.map((entry) => (
              <ListRow
                key={entry.title}
                eyebrowIcon={NOTE_KINDS.journal.icon}
                eyebrow={entry.eyebrow}
                eyebrowTone="ink3"
                title={entry.title}
                contentGap={4}
                paddingVertical={20}
                rowGap={8}
                onPress={() => {}}
                accessibilityLabel={`Journal entry, ${entry.title}, only you`}
                trailing={
                  <ListRowMore
                    onPress={() => {}}
                    accessibilityLabel={`More options for ${entry.title}`}
                    style={styles.rowTrailing}
                  />
                }
              >
                <ListenRow
                  duration={entry.duration}
                  rest={entry.rest}
                  onPress={() => {}}
                  accessibilityLabel={`Play ${entry.title}`}
                />
                <View style={styles.stateRow}>
                  <Pill
                    icon={NOTE_KINDS.public.icon}
                    label="Post it on the map"
                    tone="outlined"
                    onPress={() => {}}
                    accessibilityLabel={`Post ${entry.title} on the map, anonymously`}
                  />
                </View>
              </ListRow>
            ))}
          </List>
        ),
    },
    draft: {
      count: DRAFTS.length,
      body:
        DRAFTS.length === 0 ? (
          <EmptyRow label="No drafts. Unfinished recordings wait here." />
        ) : (
          <List>
            {DRAFTS.map((draft) => (
              <ListRow
                key={draft.title}
                eyebrowIcon={NOTE_KINDS.draft.icon}
                eyebrow={draft.eyebrow}
                eyebrowTone="ink3"
                title={draft.title}
                contentGap={4}
                paddingVertical={20}
                rowGap={8}
                onPress={() => {}}
                accessibilityLabel={`Draft, ${draft.title}, not finished`}
                trailing={
                  <ListRowMore
                    onPress={() => {}}
                    accessibilityLabel={`More options for ${draft.title}`}
                    style={styles.rowTrailing}
                  />
                }
              >
                <ListenRow
                  duration={draft.duration}
                  rest={draft.rest}
                  onPress={() => {}}
                  accessibilityLabel={`Play ${draft.title}`}
                />
                <View style={styles.stateRow}>
                  <Pill
                    icon="create-outline"
                    label="Finish it"
                    tone="ink"
                    onPress={() => {}}
                    accessibilityLabel={`Finish ${draft.title}: post it or keep it in your journal`}
                  />
                </View>
              </ListRow>
            ))}
          </List>
        ),
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.bg }}>
        <TopBar leading={null} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: navBottom + NAV_HEIGHT + 24 }}
      >
        <View style={styles.titleBlock}>
          <Text style={[styles.screenTitle, { color: theme.ink }]}>Journal</Text>
          <Text style={[styles.screenSub, { color: theme.ink2 }]}>Everything you've recorded, in one place.</Text>
        </View>

        {NOTE_KIND_ORDER.map((kind, index) => (
          <View key={kind} style={index > 0 ? styles.sectionSpaced : null}>
            <SectionHead kind={kind} count={sections[kind].count} />
            {sections[kind].body}
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="box-none" style={[styles.navWrap, { bottom: navBottom }]}>
        <FloatingNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleBlock: {
    paddingHorizontal: space.gutter,
    paddingTop: 12,
    paddingBottom: 24,
  },
  screenTitle: {
    ...textStyle.displaySans,
  },
  screenSub: {
    ...textStyle.body,
    marginTop: 4,
  },
  sectionSpaced: {
    paddingTop: 32,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space.gutter,
    paddingBottom: 14,
  },
  sectionDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionText: {
    flex: 1,
    gap: 1,
  },
  sectionName: {
    ...textStyle.headingSans,
  },
  sectionDesc: {
    ...textStyle.support,
  },
  sectionCount: {
    ...textStyle.supportStrong,
  },
  listenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 44,
  },
  playCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listenDuration: {
    ...textStyle.bodyStrong,
  },
  listenRest: {
    ...textStyle.body,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  responsesLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 44,
  },
  responsesLabel: {
    ...textStyle.support,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 16,
  },
  pillLabel: {
    ...textStyle.supportStrong,
  },
  rowTrailing: {
    alignSelf: "flex-start",
  },
  fadedRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 64,
    paddingHorizontal: space.gutter,
  },
  fadedLabel: {
    flex: 1,
    ...textStyle.body,
  },
  empty: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.gutter,
    paddingVertical: 20,
  },
  emptyLabel: {
    ...textStyle.support,
  },
  navWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
