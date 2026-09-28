import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NoteKind } from "../noteKinds";
import { pressed as pressedOpacity, radius, space, textStyle, useTheme } from "../theme";
import { TopBar } from "./TopBar";

export type ReviewSentence = {
  id: string;
  text: string;
};

export type ReviewParagraph = {
  id: string;
  tone: "ink" | "ink2";
  kind: "plain" | "redaction";
  sentences: ReviewSentence[];
};

type RecordReviewStageProps = {
  landmarkName: string;
  locationSuffix: string;
  title: string;
  onChangeTitle: (title: string) => void;
  suggestions: string[];
  onSuggestion: (suggestion: string) => void;
  playing: boolean;
  onTogglePlayback: () => void;
  durationSec: number;
  paragraphs: ReviewParagraph[];
  excludedIds: ReadonlySet<string>;
  onToggleSentence: (id: string) => void;
  onBack: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  onKeepDraft: () => void;
  /** Journal notes save privately; drafts only offer "keep"; public notes are left at a place. */
  onSaveJournal: () => void;
  kind: NoteKind;
  topInset: number;
  bottomInset: number;
};

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function RecordReviewStage({
  landmarkName,
  locationSuffix,
  title,
  onChangeTitle,
  suggestions,
  onSuggestion,
  playing,
  onTogglePlayback,
  durationSec,
  paragraphs,
  excludedIds,
  onToggleSentence,
  onBack,
  onDiscard,
  onPublish,
  onKeepDraft,
  onSaveJournal,
  kind,
  topInset,
  bottomInset,
}: RecordReviewStageProps) {
  const theme = useTheme();
  const primary: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void } =
    kind === "public"
      ? { label: `Post at ${landmarkName}`, icon: "location-outline", onPress: onPublish }
      : kind === "journal"
        ? { label: "Save to journal", icon: "lock-closed-outline", onPress: onSaveJournal }
        : { label: "Save as draft", icon: "ellipse-outline", onPress: onKeepDraft };
  const paragraphColor = { ink: theme.ink, ink2: theme.ink2 };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={{ paddingTop: topInset }}>
        <TopBar
          title="Read it back"
          leading={{ icon: "arrow-back", label: "Back to choosing a place", onPress: onBack }}
          trailing={
            <Pressable
              onPress={onDiscard}
              accessibilityRole="button"
              accessibilityLabel="Discard this note"
              style={({ pressed }) => [styles.discard, { opacity: pressed ? pressedOpacity.dim : 1 }]}
            >
              <Text style={[styles.discardLabel, { color: theme.danger }]}>Discard</Text>
            </Pressable>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.location, { color: theme.accentText }]}>
          {kind === "public" ? `${landmarkName.toUpperCase()}  ·  ${locationSuffix}` : locationSuffix}
        </Text>

        <View style={[styles.titleField, { borderBottomColor: theme.line }]}>
          <TextInput
            value={title}
            onChangeText={onChangeTitle}
            placeholder="Give it a title"
            placeholderTextColor={theme.ink3}
            accessibilityLabel="Note title"
            multiline
            scrollEnabled={false}
            style={[styles.titleInput, { color: theme.ink }]}
          />
          <Ionicons name="pencil-outline" size={16} color={theme.ink2} />
        </View>

        <View style={styles.suggestions}>
          <Text style={[styles.sectionLabel, { color: theme.ink2 }]}>Other titles we heard</Text>
          <View style={styles.chips}>
            {suggestions.map((suggestion) => {
              const selected = suggestion === title;
              return (
                <Pressable
                  key={suggestion}
                  onPress={() => onSuggestion(suggestion)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Use title: ${suggestion}`}
                  style={({ pressed }) => [
                    styles.chip,
                    selected
                      ? { borderColor: theme.accent, backgroundColor: theme.accentSoft }
                      : {
                          borderColor: theme.controlLine,
                          backgroundColor: pressed ? theme.tint : theme.surfaceClear,
                        },
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: selected ? theme.accentText : theme.ink }]}>
                    {suggestion}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.audio, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
          <Pressable
            onPress={onTogglePlayback}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause your voice note" : "Play your voice note"}
            hitSlop={5}
            style={({ pressed }) => [
              styles.playButton,
              { backgroundColor: theme.ink, opacity: pressed ? pressedOpacity.dim : 1 },
            ]}
          >
            <Ionicons name={playing ? "pause" : "play"} size={13} color={theme.surface} />
          </Pressable>
          <View style={styles.audioText}>
            <Text style={[styles.audioTitle, { color: theme.ink }]}>Hear your anonymized voice</Text>
            <Text style={[styles.audioSub, { color: theme.ink3 }]}>
              {`Pitch-shifted  ·  ${clock(durationSec)}`}
            </Text>
          </View>
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.ink3} />
        </View>

        <View style={styles.transcript}>
          <View style={styles.transcriptHead}>
            <Text style={[styles.sectionLabel, { color: theme.ink2 }]}>Transcript</Text>
            <Text style={[styles.editText, { color: theme.ink }]}>Edit text</Text>
          </View>

          {paragraphs.map((paragraph) => (
            <View
              key={paragraph.id}
              style={
                paragraph.kind === "redaction"
                  ? [styles.redaction, { backgroundColor: theme.accentSoft }]
                  : undefined
              }
            >
              <Text style={[styles.paragraph, { color: paragraphColor[paragraph.tone] }]}>
                {paragraph.sentences.map((sentence, index) => {
                  const excluded = excludedIds.has(sentence.id);
                  return (
                    <Text
                      key={sentence.id}
                      onPress={() => onToggleSentence(sentence.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: excluded }}
                      accessibilityLabel={
                        excluded
                          ? `Restore sentence: ${sentence.text}`
                          : `Cut sentence: ${sentence.text}`
                      }
                      style={
                        excluded
                          ? { color: theme.ink3, textDecorationLine: "line-through" }
                          : undefined
                      }
                    >
                      {sentence.text}
                      {index < paragraph.sentences.length - 1 ? " " : ""}
                    </Text>
                  );
                })}
              </Text>
              {paragraph.kind === "redaction" ? (
                <View style={styles.redactionNote}>
                  <Ionicons name="eye-off-outline" size={13} color={theme.accentText} />
                  <Text style={[styles.redactionLabel, { color: theme.accentText }]}>
                    We removed a name to keep you anonymous.
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.actions,
          { backgroundColor: theme.bg, paddingBottom: bottomInset + space.md },
        ]}
      >
        <Pressable
          onPress={primary.onPress}
          accessibilityRole="button"
          accessibilityLabel={primary.label}
          style={({ pressed }) => [
            styles.publish,
            { backgroundColor: theme.ink, opacity: pressed ? pressedOpacity.soft : 1 },
          ]}
        >
          <Ionicons name={primary.icon} size={16} color={theme.surface} />
          <Text style={[styles.publishLabel, { color: theme.surface }]}>{primary.label}</Text>
        </Pressable>
        {kind === "draft" ? null : (
          <Pressable
            onPress={onKeepDraft}
            accessibilityRole="button"
            accessibilityLabel="Save as a draft instead"
            style={({ pressed }) => [styles.draft, { opacity: pressed ? pressedOpacity.dim : 1 }]}
          >
            <Text style={[styles.draftLabel, { color: theme.ink2 }]}>Save as a draft instead</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  discard: {
    height: 44,
    paddingLeft: space.sm,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  discardLabel: {
    ...textStyle.supportStrong,
  },
  content: {
    paddingTop: space.md,
    paddingHorizontal: space.gutter,
    paddingBottom: space.lg,
  },
  location: {
    ...textStyle.caps,
  },
  titleField: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingTop: space.sm,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleInput: {
    flex: 1,
    padding: 0,
    ...textStyle.titleSerif,
  },
  sectionLabel: {
    ...textStyle.supportStrong,
  },
  suggestions: {
    gap: space.sm,
    paddingTop: 12,
    paddingBottom: space.lg,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  chip: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: {
    ...textStyle.chipSerif,
  },
  audio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  audioText: {
    flex: 1,
    gap: 2,
  },
  audioTitle: {
    ...textStyle.body,
  },
  audioSub: {
    ...textStyle.support,
  },
  transcript: {
    gap: space.md,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  transcriptHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editText: {
    ...textStyle.support,
  },
  paragraph: {
    ...textStyle.reading,
  },
  redaction: {
    gap: 10,
    padding: 16,
    borderRadius: radius.md,
  },
  redactionNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  redactionLabel: {
    flex: 1,
    ...textStyle.support,
  },
  actions: {
    gap: 14,
    paddingTop: space.sm,
    paddingHorizontal: space.gutter,
  },
  publish: {
    height: 52,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  publishLabel: {
    ...textStyle.bodyStrong,
  },
  draft: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  draftLabel: {
    ...textStyle.support,
  },
});
