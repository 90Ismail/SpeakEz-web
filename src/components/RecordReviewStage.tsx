import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fonts, radius, space, type, useTheme } from "../theme";
import { Caps } from "./Caps";
import { RecordTopBar } from "./RecordTopBar";

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
  topInset,
  bottomInset,
}: RecordReviewStageProps) {
  const theme = useTheme();
  const paragraphColor = { ink: theme.ink, ink2: theme.ink2 };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={{ paddingTop: topInset }}>
        <RecordTopBar
          title="Read it back"
          leadingIcon="arrow-back"
          leadingLabel="Back to choosing a place"
          onLeadingPress={onBack}
          trailing={
            <Pressable
              onPress={onDiscard}
              accessibilityRole="button"
              accessibilityLabel="Discard this note"
              style={styles.discard}
            >
              <Text style={[styles.discardLabel, { color: theme.danger }]}>Discard</Text>
            </Pressable>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Caps tone="accent" style={styles.location}>
          {`${landmarkName.toUpperCase()}  ·  ${locationSuffix}`}
        </Caps>

        <View style={[styles.titleField, { borderBottomColor: theme.ink }]}>
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
          <Caps tone="ink3">OTHER TITLES WE HEARD</Caps>
          <View style={styles.chips}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => onSuggestion(suggestion)}
                accessibilityRole="button"
                accessibilityLabel={`Use title: ${suggestion}`}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.controlLine, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.chipLabel, { color: theme.ink }]}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.audio}>
          <Pressable
            onPress={onTogglePlayback}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause your voice note" : "Play your voice note"}
            hitSlop={5}
            style={({ pressed }) => [
              styles.playButton,
              { backgroundColor: theme.ink, opacity: pressed ? 0.8 : 1 },
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
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.ink2} />
        </View>

        <View style={styles.transcript}>
          <View style={styles.transcriptHead}>
            <Caps tone="ink3">TRANSCRIPT</Caps>
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
                  <Ionicons name="eye-off-outline" size={13} color={theme.accent} />
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
          onPress={onPublish}
          accessibilityRole="button"
          accessibilityLabel={`Leave it at ${landmarkName}`}
          style={({ pressed }) => [
            styles.publish,
            { backgroundColor: theme.ink, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="location" size={15} color={theme.surface} />
          <Text style={[styles.publishLabel, { color: theme.surface }]}>
            Leave it at {landmarkName}
          </Text>
        </Pressable>
        <Pressable
          onPress={onKeepDraft}
          accessibilityRole="button"
          accessibilityLabel="Keep as a private draft"
          style={styles.draft}
        >
          <Text style={[styles.draftLabel, { color: theme.ink2 }]}>Keep as a private draft</Text>
        </Pressable>
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
    fontFamily: fonts.sansSemibold,
    fontSize: type.support },
  content: {
    paddingTop: space.md,
    paddingHorizontal: space.gutter,
    paddingBottom: space.lg,
  },
  location: {
    letterSpacing: 1.4,
  },
  titleField: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  titleInput: {
    flex: 1,
    padding: 0,
    fontFamily: fonts.sansBold,
    fontSize: type.title,
    lineHeight: type.title * 1.1,
    letterSpacing: -0.7 },
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
    paddingHorizontal: 13,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontStyle: "italic" },
  audio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
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
    fontFamily: fonts.sans,
    fontSize: type.body },
  audioSub: {
    fontFamily: fonts.sans,
    fontSize: type.support },
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
    fontFamily: fonts.sans,
    fontSize: type.support },
  paragraph: {
    fontFamily: fonts.serif,
    fontSize: type.reading,
    lineHeight: 27 },
  redaction: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.xs,
  },
  redactionNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  redactionLabel: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.support },
  actions: {
    gap: 14,
    paddingTop: space.sm,
    paddingHorizontal: space.gutter,
  },
  publish: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  publishLabel: {
    fontFamily: fonts.sansBold,
    fontSize: type.body },
  draft: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  draftLabel: {
    fontFamily: fonts.sans,
    fontSize: type.support },
});
