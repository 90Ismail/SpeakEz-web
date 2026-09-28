import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { landmarkById } from "../src/campusLandmarks";
import { IconButton } from "../src/components/IconButton";
import { formatDuration, ListRow, ListRowMore } from "../src/components/ListRow";
import { TopBar } from "../src/components/TopBar";
import { seedNoteById } from "../src/seedNotes";
import { pressed as pressedOpacity, space, textStyle, useTheme } from "../src/theme";

type IoniconName = keyof typeof Ionicons.glyphMap;

const LIVE_META: { id: string; fades: string }[] = [
  { id: "failing-first-semester", fades: "Fades in 27 days" },
  { id: "tired-at-walter", fades: "Fades in 22 days" },
];

const DRAFT = {
  eyebrow: "SEPT 25 · COFFMAN UNION",
  title: "Something I want to tell my brother",
  duration: "1:06",
  rest: "·  Not placed yet",
};

const PRIVATE = {
  eyebrow: "SEPT 21 · PILLSBURY HALL",
  title: "Things I'm not ready to say yet",
  duration: "1:48",
  rest: "·  Doesn't fade",
};

/** State glyphs shared by the section disc and each row's meta line. */
const STATE_ICON: Record<"draft" | "public" | "private", IoniconName> = {
  draft: "ellipse-outline",
  public: "radio-outline",
  private: "lock-closed-outline",
};

type SectionHeadProps = {
  kind: keyof typeof STATE_ICON;
  name: string;
  description: string;
  count: number;
};

function SectionHead({ kind, name, description, count }: SectionHeadProps) {
  const theme = useTheme();
  const disc =
    kind === "public"
      ? { backgroundColor: theme.accentSoft, color: theme.accentText }
      : { backgroundColor: theme.tint, color: kind === "draft" ? theme.ink2 : theme.ink };
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${name}, ${description}, ${count}`}
      style={styles.sectionHead}
    >
      <View style={[styles.sectionDisc, { backgroundColor: disc.backgroundColor }]}>
        <Ionicons name={STATE_ICON[kind]} size={16} color={disc.color} />
      </View>
      <View style={styles.sectionText}>
        <Text style={[styles.sectionName, { color: theme.ink }]}>{name}</Text>
        <Text style={[styles.sectionDesc, { color: theme.ink3 }]}>{description}</Text>
      </View>
      <Text style={[styles.sectionCount, { color: theme.ink3 }]}>{count}</Text>
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

export default function MyPostsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.bg }}>
        <TopBar
          leading={{ label: "Go back", onPress: () => router.back() }}
          trailing={
            <IconButton
              icon="mic"
              variant="tint"
              size={44}
              iconSize={18}
              onPress={() => router.push("/record")}
              accessibilityLabel="Record a voice note"
            />
          }
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={styles.titleBlock}>
          <Text style={[styles.screenTitle, { color: theme.ink }]}>My Posts</Text>
        </View>

        <View>
          <SectionHead kind="draft" name="Drafts" description="Unfinished · only you" count={1} />
          <List>
            <ListRow
              eyebrowIcon={STATE_ICON.draft}
              eyebrow={DRAFT.eyebrow}
              eyebrowTone="ink3"
              title={DRAFT.title}
              contentGap={4}
              paddingVertical={20}
              rowGap={8}
              onPress={() => {}}
              accessibilityLabel="Draft, not published"
              trailing={<ListRowMore onPress={() => {}} accessibilityLabel="More options for the draft" style={styles.rowTrailing} />}
            >
              <ListenRow
                duration={DRAFT.duration}
                rest={DRAFT.rest}
                onPress={() => {}}
                accessibilityLabel="Draft, not published"
              />
              <View style={styles.stateRow}>
                <Pill
                  icon="location-outline"
                  label="Review & place"
                  tone="ink"
                  onPress={() => {}}
                  accessibilityLabel="Draft, not published. Review and place"
                />
              </View>
            </ListRow>
          </List>
        </View>

        <View style={styles.sectionSpaced}>
          <SectionHead kind="public" name="Public" description="Live on the map" count={LIVE_META.length} />
          <List>
            {LIVE_META.map(({ id, fades }) => {
              const note = seedNoteById(id);
              if (!note) return null;
              const landmarkName = landmarkById(note.landmarkId)?.name ?? "Campus";
              return (
                <ListRow
                  key={note.id}
                  eyebrowIcon={STATE_ICON.public}
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
        </View>

        <View accessible accessibilityRole="text" accessibilityLabel="3 earlier notes have faded" style={styles.fadedRow}>
          <Ionicons name="archive-outline" size={18} color={theme.ink2} />
          <Text style={[styles.fadedLabel, { color: theme.ink2 }]}>3 earlier notes have faded</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.ink2} />
        </View>

        <View style={styles.sectionSpaced}>
          <SectionHead kind="private" name="Private" description="Finished · only you" count={1} />
          <List>
            <ListRow
              eyebrowIcon={STATE_ICON.private}
              eyebrow={PRIVATE.eyebrow}
              eyebrowTone="ink3"
              title={PRIVATE.title}
              contentGap={4}
              paddingVertical={20}
              rowGap={8}
              onPress={() => {}}
              accessibilityLabel="Private note, only you"
              trailing={
                <ListRowMore onPress={() => {}} accessibilityLabel="More options for the private note" style={styles.rowTrailing} />
              }
            >
              <ListenRow
                duration={PRIVATE.duration}
                rest={PRIVATE.rest}
                onPress={() => {}}
                accessibilityLabel={`Play ${PRIVATE.title}`}
              />
              <View style={styles.stateRow}>
                <Pill
                  icon="radio-outline"
                  label="Put it on the map"
                  tone="outlined"
                  onPress={() => {}}
                  accessibilityLabel="Private note. Put it on the map"
                />
              </View>
            </ListRow>
          </List>
        </View>
      </ScrollView>
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
  sectionSpaced: {
    paddingTop: 24,
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
});
