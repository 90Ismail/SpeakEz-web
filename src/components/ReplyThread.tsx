import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Reply } from "../api";
import { pressed as pressedOpacity, radius, space, textStyle, useTheme } from "../theme";
import { formatDuration } from "./ListRow";

type ReplyThreadProps = {
  replies: Reply[];
  placeName: string;
  onReply: () => void;
};

function ReplyRow({ reply, first }: { reply: Reply; first: boolean }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const meta = [reply.dayLabel, reply.durationSec > 0 ? formatDuration(reply.durationSec) : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      onPress={() => setExpanded((value) => !value)}
      accessibilityRole="button"
      accessibilityLabel={`Anonymous reply, ${meta}. ${reply.body}`}
      accessibilityHint={expanded ? "Collapses the reply" : "Shows the whole reply"}
      style={({ pressed }) => [
        styles.row,
        !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null,
        { backgroundColor: pressed ? theme.tint : theme.surfaceClear },
      ]}
    >
      <View style={styles.rowHead}>
        <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
          <Ionicons name="mic-outline" size={12} color={theme.ink2} />
        </View>
        <Text style={[styles.who, { color: theme.ink2 }]}>Anonymous student</Text>
        <Text style={[styles.meta, { color: theme.ink3 }]}>{meta}</Text>
      </View>
      <Text numberOfLines={expanded ? undefined : 3} style={[styles.body, { color: theme.ink }]}>
        {reply.body}
      </Text>
    </Pressable>
  );
}

/**
 * The thread under an original post. The post itself stays first (it's the story
 * above); replies follow oldest first, all anonymous, and unlock with the post.
 */
export function ReplyThread({ replies, placeName, onReply }: ReplyThreadProps) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.ink2 }]}>Replies</Text>
        {replies.length > 0 ? (
          <View style={[styles.count, { backgroundColor: theme.tint }]}>
            <Text style={[styles.countLabel, { color: theme.ink2 }]}>{replies.length}</Text>
          </View>
        ) : null}
      </View>

      {replies.length > 0 ? (
        <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.surface }]}>
          {replies.map((reply, index) => (
            <ReplyRow key={reply.id} reply={reply} first={index === 0} />
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, { color: theme.ink3 }]}>
          No replies yet. You&apos;re at {placeName}, so you can be the first.
        </Text>
      )}

      <Pressable
        onPress={onReply}
        accessibilityRole="button"
        accessibilityLabel="Reply with your voice"
        accessibilityHint={`Records an anonymous reply that stays at ${placeName}`}
        style={({ pressed }) => [
          styles.replyButton,
          { borderColor: theme.controlLine, opacity: pressed ? pressedOpacity.soft : 1 },
        ]}
      >
        <Ionicons name="mic-outline" size={16} color={theme.ink} />
        <Text style={[styles.replyLabel, { color: theme.ink }]}>Reply with your voice</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: space.lg,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    ...textStyle.supportStrong,
  },
  count: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  countLabel: {
    ...textStyle.meta,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: space.md,
    paddingVertical: 14,
    gap: 8,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  who: {
    ...textStyle.supportStrong,
  },
  meta: {
    flex: 1,
    textAlign: "right",
    ...textStyle.support,
  },
  body: {
    ...textStyle.excerpt,
  },
  empty: {
    ...textStyle.support,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  replyLabel: {
    ...textStyle.bodyStrong,
  },
});
