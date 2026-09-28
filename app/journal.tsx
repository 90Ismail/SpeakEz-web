import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { landmarkById } from "../src/campusLandmarks";
import { FloatingNav, NAV_HEIGHT } from "../src/components/FloatingNav";
import { formatDuration } from "../src/components/ListRow";
import { TopBar } from "../src/components/TopBar";
import { NOTE_KIND_ORDER, NOTE_KINDS, type NoteKind } from "../src/noteKinds";
import { seedNoteById } from "../src/seedNotes";
import { pressed as pressedOpacity, radius, space, textStyle, useTheme } from "../src/theme";

/** One recording as the Journal shows it: a title and a single short detail line. */
type JournalItem = {
  id: string;
  title: string;
  detail: string;
  /** Public posts open their story; private ones have nowhere to go yet. */
  storyId?: string;
};

const PUBLIC_POST_IDS = ["failing-first-semester", "tired-at-walter"];

const PUBLIC_POSTS: JournalItem[] = PUBLIC_POST_IDS.flatMap((id) => {
  const note = seedNoteById(id);
  if (!note) return [];
  const place = landmarkById(note.landmarkId)?.name ?? "Campus";
  return [
    {
      id: note.id,
      title: note.title,
      detail: `${place} · ${note.dayLabel} · ${formatDuration(note.durationSec)}`,
      storyId: note.id,
    },
  ];
});

const JOURNAL_ENTRIES: JournalItem[] = [
  { id: "journal-not-ready", title: "Things I'm not ready to say yet", detail: "Sept 21 · 1:48" },
];

const DRAFTS: JournalItem[] = [
  { id: "draft-brother", title: "Something I want to tell my brother", detail: "Sept 25 · 1:06 · Not finished" },
];

const ITEMS: Record<NoteKind, JournalItem[]> = {
  public: PUBLIC_POSTS,
  journal: JOURNAL_ENTRIES,
  draft: DRAFTS,
};

const EMPTY: Record<NoteKind, string> = {
  public: "Nothing posted yet. Record a note and leave it somewhere on campus.",
  journal: "Nothing here yet. Private recordings land here.",
  draft: "No drafts. Unfinished recordings wait here.",
};

function Row({ item, kind, first }: { item: JournalItem; kind: NoteKind; first: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const open = item.storyId ? () => router.push(`/story/${item.storyId}`) : undefined;
  return (
    <Pressable
      onPress={open}
      disabled={!open}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.detail}`}
      accessibilityHint={open ? "Opens the note" : undefined}
      style={({ pressed }) => [
        styles.row,
        !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null,
        { backgroundColor: pressed ? theme.tint : theme.surfaceClear },
      ]}
    >
      <View style={[styles.play, { borderColor: kind === "public" ? theme.accentLine : theme.controlLine }]}>
        <Ionicons name="play" size={13} color={kind === "public" ? theme.accentText : theme.ink} />
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: theme.ink }]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[styles.rowDetail, { color: theme.ink3 }]}>
          {item.detail}
        </Text>
      </View>
      {open ? <Ionicons name="chevron-forward" size={16} color={theme.ink3} /> : null}
    </Pressable>
  );
}

function SectionCard({ kind }: { kind: NoteKind }) {
  const theme = useTheme();
  const info = NOTE_KINDS[kind];
  const items = ITEMS[kind];
  const isPublic = kind === "public";
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${info.section}, ${info.summary}, ${items.length}`}
        style={[styles.cardHead, { borderBottomColor: theme.line }]}
      >
        <View style={[styles.cardIcon, { backgroundColor: isPublic ? theme.accentSoft : theme.tint }]}>
          <Ionicons name={info.icon} size={16} color={isPublic ? theme.accentText : theme.ink} />
        </View>
        <View style={styles.cardHeadText}>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>{info.section}</Text>
          <Text style={[styles.cardSummary, { color: theme.ink3 }]}>{info.summary}</Text>
        </View>
        <View style={[styles.count, { backgroundColor: theme.tint }]}>
          <Text style={[styles.countLabel, { color: theme.ink2 }]}>{items.length}</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: theme.ink3 }]}>{EMPTY[kind]}</Text>
      ) : (
        items.map((item, index) => <Row key={item.id} item={item} kind={kind} first={index === 0} />)
      )}
    </View>
  );
}

export default function JournalScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navBottom = insets.bottom + 4;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.bg }}>
        <TopBar leading={null} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: navBottom + NAV_HEIGHT + space.lg }]}
      >
        <View style={styles.titleBlock}>
          <Text style={[styles.screenTitle, { color: theme.ink }]}>Journal</Text>
          <Text style={[styles.screenSub, { color: theme.ink2 }]}>Everything you've recorded.</Text>
        </View>
        {NOTE_KIND_ORDER.map((kind) => (
          <SectionCard key={kind} kind={kind} />
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
  content: {
    paddingHorizontal: space.md,
    gap: space.md,
  },
  titleBlock: {
    paddingHorizontal: space.sm,
    paddingTop: 12,
    paddingBottom: space.sm,
    gap: 4,
  },
  screenTitle: {
    ...textStyle.displaySans,
  },
  screenSub: {
    ...textStyle.body,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeadText: {
    flex: 1,
    gap: 1,
  },
  cardTitle: {
    ...textStyle.headingSans,
  },
  cardSummary: {
    ...textStyle.support,
  },
  count: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  countLabel: {
    ...textStyle.supportStrong,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...textStyle.bodyStrong,
  },
  rowDetail: {
    ...textStyle.support,
  },
  empty: {
    ...textStyle.support,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  navWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
