import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { landmarkById } from "../src/campusLandmarks";
import { Caps } from "../src/components/Caps";
import { IconButton } from "../src/components/IconButton";
import { formatDuration, ListRow } from "../src/components/ListRow";
import { seedNoteById } from "../src/seedNotes";
import { fonts, fontWeight, type, useTheme } from "../src/theme";

const LIVE_META: { id: string; fades: string }[] = [
  { id: "failing-first-semester", fades: "Fades in 27 days" },
  { id: "tired-at-walter", fades: "Fades in 22 days" },
];

const DRAFT = {
  eyebrow: "SEPT 25 · COFFMAN UNION",
  title: "Something I want to tell my brother",
  duration: "1:06",
  rest: "· Not placed yet",
};

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
        style={({ pressed }) => [styles.playCircle, { borderColor: theme.controlLine }, pressed && styles.pressed]}
      >
        <Ionicons name="play" size={13} color={theme.ink} />
      </Pressable>
      <Text style={[styles.listenDuration, { color: theme.ink }]}>{duration}</Text>
      <Text style={[styles.listenRest, { color: theme.ink2 }]}>{rest}</Text>
    </View>
  );
}

export default function MyPostsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.bg }}>
        <View style={styles.topBar}>
          <IconButton
            icon="arrow-back"
            variant="tint"
            size={44}
            iconSize={19}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          />
          <Text style={[styles.topBarTitle, { color: theme.ink }]}>My Posts</Text>
          <IconButton
            icon="mic"
            variant="tint"
            size={44}
            iconSize={18}
            onPress={() => router.push("/record")}
            accessibilityLabel="Record a voice note"
          />
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={styles.titleBlock}>
          <Text style={[styles.screenTitle, { color: theme.ink }]}>My Posts</Text>
        </View>
        <View>
          <View style={styles.sectionHead}>
            <Caps tone="ink3" style={styles.sectionLabel}>
              LIVE ON CAMPUS
            </Caps>
          </View>
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }}>
            {LIVE_META.map(({ id, fades }) => {
              const note = seedNoteById(id);
              if (!note) return null;
              const landmarkName = landmarkById(note.landmarkId)?.name ?? "Campus";
              return (
                <ListRow
                  key={note.id}
                  eyebrow={`${note.dayLabel.toUpperCase()} · ${landmarkName.toUpperCase()}`}
                  eyebrowTone="ink3"
                  title={note.title}
                  contentGap={4}
                  paddingVertical={20}
                  rowGap={8}
                  onPress={() => router.push(`/story/${note.id}`)}
                  accessibilityLabel={`Open ${note.title} at ${landmarkName}`}
                  trailing={
                    <IconButton
                      icon="ellipsis-horizontal"
                      variant="plain"
                      iconSize={18}
                      onPress={() => {}}
                      accessibilityLabel={`More options for ${note.title}`}
                      style={styles.rowTrailing}
                    />
                  }
                >
                  <ListenRow
                    duration={formatDuration(note.durationSec)}
                    rest={`· ${fades}`}
                    onPress={() => router.push(`/story/${note.id}`)}
                    accessibilityLabel={`Play ${note.title}`}
                  />
                  <View style={styles.stateRow}>
                    <View style={[styles.tag, { backgroundColor: theme.accentSoft }]}>
                      <Ionicons name="radio-outline" size={13} color={theme.accentText} />
                      <Text style={[styles.tagLabel, { color: theme.accentText }]}>Live at this spot</Text>
                    </View>
                    <Pressable
                      onPress={() => {}}
                      accessibilityRole="button"
                      accessibilityLabel={`Read quiet responses to ${note.title}`}
                      style={styles.responsesLink}
                    >
                      <Ionicons name="heart-outline" size={14} color={theme.ink2} />
                      <Text style={[styles.responsesLabel, { color: theme.ink2 }]}>Read quiet responses</Text>
                    </Pressable>
                  </View>
                </ListRow>
              );
            })}
          </View>
        </View>
        <View style={styles.sectionSpaced}>
          <View style={styles.sectionHead}>
            <Caps tone="ink3" style={styles.sectionLabel}>
              DRAFTS
            </Caps>
          </View>
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }}>
            <ListRow
              eyebrow={DRAFT.eyebrow}
              eyebrowTone="ink3"
              title={DRAFT.title}
              contentGap={4}
              paddingVertical={20}
              rowGap={8}
              onPress={() => {}}
              accessibilityLabel="Draft, not published"
              trailing={
                <IconButton
                  icon="ellipsis-horizontal"
                  variant="plain"
                  iconSize={18}
                  onPress={() => {}}
                  accessibilityLabel="More options for the draft"
                  style={styles.rowTrailing}
                />
              }
            >
              <ListenRow
                duration={DRAFT.duration}
                rest={DRAFT.rest}
                onPress={() => {}}
                accessibilityLabel="Draft, not published"
              />
              <View style={styles.stateRow}>
                <Pressable
                  onPress={() => {}}
                  accessibilityRole="button"
                  accessibilityLabel="Draft, not published. Review and place"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.ink },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="location-outline" size={13} color={theme.bg} />
                  <Text style={[styles.primaryLabel, { color: theme.bg }]}>Review & place</Text>
                </Pressable>
              </View>
            </ListRow>
          </View>
        </View>
        <View accessible accessibilityRole="text" accessibilityLabel="3 earlier notes have faded" style={styles.fadedRow}>
          <Ionicons name="archive-outline" size={18} color={theme.ink2} />
          <Text style={[styles.fadedLabel, { color: theme.ink2 }]}>3 earlier notes have faded</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.ink2} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 24,
    gap: 8,
  },
  topBarTitle: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.semibold,
  },
  titleBlock: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  screenTitle: {
    fontFamily: fonts.sans,
    fontSize: type.display,
    fontWeight: fontWeight.bold,
    letterSpacing: -1,
  },
  sectionHead: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  sectionLabel: {
    letterSpacing: 1.4,
  },
  sectionSpaced: {
    paddingTop: 24,
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
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.bold,
  },
  listenRest: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.regular,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 25,
    borderRadius: 14,
    paddingLeft: 8,
    paddingRight: 10,
  },
  tagLabel: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.bold,
  },
  responsesLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 44,
  },
  responsesLabel: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.regular,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingLeft: 14,
  },
  primaryLabel: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.bold,
  },
  rowTrailing: {
    alignSelf: "flex-start",
  },
  fadedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 64,
    paddingHorizontal: 24,
  },
  fadedLabel: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.regular,
  },
  pressed: {
    opacity: 0.7,
  },
});
