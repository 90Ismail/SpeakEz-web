import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Caps } from "../src/components/Caps";
import { OnboardingTopBar } from "../src/components/OnboardingTopBar";
import { fonts, radius, space, type, useTheme } from "../src/theme";

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
    label: "RIGHT NOW",
    rows: [
      {
        icon: "call",
        title: "988 Suicide & Crisis Lifeline",
        description: "Call or text 988  ·  24/7",
        action: { url: "tel:988", hint: "Opens the phone app" },
      },
      {
        icon: "chatbubble",
        title: "Crisis Text Line",
        description: "Text HOME to 741741",
        action: { url: "sms:741741&body=HOME", hint: "Opens the messages app" },
      },
    ],
  },
  {
    label: "ON CAMPUS",
    rows: [
      {
        icon: "calendar",
        title: "Student Counseling Services",
        description: "Free, confidential  ·  same-week visits",
      },
      {
        icon: "location",
        title: "Boynton Mental Health Clinic",
        description: "Walk-in support on the East Bank",
      },
    ],
  },
  {
    label: "ON SPEAKEZ",
    rows: [
      {
        icon: "flag",
        title: "Report a note",
        description: "If something feels unsafe or targeted",
      },
      {
        icon: "shield",
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
    const body = (
      <View style={styles.rowInner}>
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
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: theme.line, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {body}
        </Pressable>
      );
    }
    return (
      <View key={row.title} style={[styles.row, { borderBottomColor: theme.line }]}>
        {body}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <OnboardingTopBar onBack={() => router.back()} title="Help & resources" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: theme.ink }]}>
          You don&apos;t have to carry it alone.
        </Text>
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
            { backgroundColor: theme.dangerSoft, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="warning" size={16} color={theme.danger} />
          <Text style={[styles.emergencyText, { color: theme.danger }]}>
            In immediate danger? Call 911.
          </Text>
        </Pressable>
        {SECTIONS.map((section) => (
          <View key={section.label} style={styles.section}>
            <Caps tone="ink3" style={styles.sectionLabel}>
              {section.label}
            </Caps>
            <View style={styles.list}>{section.rows.map(renderRow)}</View>
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
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  headline: {
    fontFamily: fonts.sansBold,
    fontSize: type.display,
    lineHeight: 35,
    letterSpacing: -1 },
  intro: {
    marginTop: 12,
    marginBottom: 20,
    fontFamily: fonts.sans,
    fontSize: type.body,
    lineHeight: 23 },
  emergency: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.xs,
  },
  emergencyText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.support },
  section: {
    paddingTop: 24,
  },
  sectionLabel: {
    letterSpacing: 1.5,
  },
  list: {
    marginTop: 4,
  },
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  rowText: {
    flex: 1,
    gap: 2,
    paddingVertical: 12,
  },
  rowTitle: {
    fontFamily: fonts.sansBold,
    fontSize: type.heading,
    lineHeight: 21,
    letterSpacing: -0.2 },
  rowDescription: {
    fontFamily: fonts.sans,
    fontSize: type.support },
  rowAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
