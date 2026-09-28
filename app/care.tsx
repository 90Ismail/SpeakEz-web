import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "../src/components/TopBar";
import { pressed as pressedOpacity, radius, space, textStyle, useTheme } from "../src/theme";

type CareRow = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  action?: { url: string; hint: string };
};

type CareSection = {
  label: string;
  rows: CareRow[];
};

const SECTIONS: CareSection[] = [
  {
    label: "Right now",
    rows: [
      {
        icon: "call-outline",
        title: "988 Suicide & Crisis Lifeline",
        description: "Call or text 988  ·  24/7",
        action: { url: "tel:988", hint: "Opens the phone app" },
      },
      {
        icon: "chatbubble-outline",
        title: "Crisis Text Line",
        description: "Text HOME to 741741",
        action: { url: "sms:741741&body=HOME", hint: "Opens the messages app" },
      },
    ],
  },
  {
    label: "On campus",
    rows: [
      {
        icon: "calendar-outline",
        title: "Student Counseling Services",
        description: "Free, confidential  ·  same-week visits",
      },
      {
        icon: "location-outline",
        title: "Boynton Mental Health Clinic",
        description: "Walk-in support on the East Bank",
      },
    ],
  },
  {
    label: "On SpeakEz",
    rows: [
      {
        icon: "flag-outline",
        title: "Report a note",
        description: "If something feels unsafe or targeted",
      },
      {
        icon: "shield-outline",
        title: "How anonymity works",
        description: "What we store, and what we never do",
      },
    ],
  },
];

export default function CareScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const renderRow = (row: CareRow) => {
    const action = row.action;
    // The hairline sits inside the gutter; the pressed tint fills edge to edge.
    const body = (
      <View style={[styles.rowInner, { borderBottomColor: theme.line }]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.ink }]}>{row.title}</Text>
          <Text style={[styles.rowDescription, { color: theme.ink3 }]}>{row.description}</Text>
        </View>
        <View
          style={[styles.rowAction, { borderColor: theme.controlLine }]}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          <Ionicons name={row.icon} size={16} color={theme.ink} />
        </View>
      </View>
    );
    if (action) {
      return (
        <Pressable
          key={row.title}
          onPress={() => Linking.openURL(action.url)}
          accessibilityRole="button"
          accessibilityLabel={`${row.title}. ${row.description}`}
          accessibilityHint={action.hint}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.tint }]}
        >
          {body}
        </Pressable>
      );
    }
    return (
      <View key={row.title} style={styles.row}>
        {body}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <TopBar leading={{ label: "Go back", onPress: () => router.back() }} title="Help & resources" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gutter}>
          <Text style={[styles.headline, { color: theme.ink }]}>You don&apos;t have to carry it alone.</Text>
          <Text style={[styles.intro, { color: theme.ink2 }]}>
            SpeakEz is a place to be heard, but it isn&apos;t a crisis service. If tonight feels heavy, these
            people are ready to listen — anonymously, if you want.
          </Text>
          <Pressable
            onPress={() => Linking.openURL("tel:911")}
            accessibilityRole="button"
            accessibilityLabel="In immediate danger? Call 911"
            accessibilityHint="Opens the phone app"
            style={({ pressed }) => [
              styles.emergency,
              { backgroundColor: theme.dangerSoft, opacity: pressed ? pressedOpacity.soft : 1 },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
            <Text style={[styles.emergencyText, { color: theme.danger }]}>In immediate danger? Call 911.</Text>
          </Pressable>
        </View>
        {SECTIONS.map((section) => (
          <View key={section.label} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.ink2 }]}>{section.label}</Text>
            <View>{section.rows.map(renderRow)}</View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: 28,
  },
  gutter: {
    paddingHorizontal: space.gutter,
  },
  headline: {
    ...textStyle.displaySerif,
  },
  intro: {
    marginTop: 14,
    marginBottom: 20,
    ...textStyle.body,
    lineHeight: 23,
  },
  emergency: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  emergencyText: {
    flex: 1,
    ...textStyle.support,
  },
  section: {
    paddingTop: 24,
  },
  sectionLabel: {
    ...textStyle.supportStrong,
    paddingHorizontal: space.gutter,
    paddingBottom: 4,
  },
  row: {
    paddingHorizontal: space.gutter,
  },
  rowInner: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: 2,
    paddingVertical: 12,
  },
  rowTitle: {
    ...textStyle.headingSans,
  },
  rowDescription: {
    ...textStyle.support,
  },
  rowAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
