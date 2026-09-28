import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fonts, pressed as pressedOpacity, radius, shadow, type as typeSize, useTheme } from "../theme";

type TabRoute = "/" | "/journal" | "/saved";
type PushRoute = "/record" | "/profile";

type NavItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  route: TabRoute | PushRoute;
  /** Tabs switch in place; pushed routes stack on top (record flow, profile drawer). */
  kind: "tab" | "push";
  accent: boolean;
};

/** Map and your own notes on the left, record in the middle, other people's notes and you on the right. */
const ITEMS: NavItem[] = [
  { key: "map", icon: "map-outline", activeIcon: "map", label: "Map", hint: "Voice notes around campus", route: "/", kind: "tab", accent: false },
  { key: "journal", icon: "book-outline", activeIcon: "book", label: "Journal", hint: "Your posts, voice journal and drafts", route: "/journal", kind: "tab", accent: false },
  { key: "record", icon: "mic", activeIcon: "mic", label: "Record", hint: "Record a voice note", route: "/record", kind: "push", accent: true },
  { key: "saved", icon: "bookmark-outline", activeIcon: "bookmark", label: "Saved", hint: "Notes you saved from the map", route: "/saved", kind: "tab", accent: false },
  { key: "profile", icon: "person-circle-outline", activeIcon: "person-circle", label: "Profile", hint: "Account, help and settings", route: "/profile", kind: "push", accent: false },
];

const ITEM_HEIGHT = 56;
const PADDING = 5;

/** Full height of the nav pill, for screens that stack controls above it. */
export const NAV_HEIGHT = ITEM_HEIGHT + PADDING * 2;

type FloatingNavProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Floating Nav: frost pill with a hairline glass stroke and the float shadow.
 * Five labelled items. Map, Journal and Saved are tabs (active = accentSoft
 * pill + filled icon); Record is the accent disc; Profile opens the drawer and
 * never reads as active.
 */
export function FloatingNav({ style }: FloatingNavProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  function open(item: NavItem) {
    if (item.kind === "push") {
      router.push(item.route);
      return;
    }
    // Tabs navigate instead of push so hopping between them doesn't stack duplicate screens.
    router.navigate(item.route);
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.container,
        {
          backgroundColor: theme.frost,
          borderColor: theme.glassStroke,
          shadowColor: theme.glassShadow,
        },
        style,
      ]}
    >
      {ITEMS.map((item) => {
        const active =
          item.kind === "tab" && (item.route === "/" ? pathname === "/" : pathname.startsWith(item.route));
        const iconColor = item.accent ? theme.onAccent : active ? theme.accentText : theme.ink2;
        const labelColor = active ? theme.accentText : item.accent ? theme.ink : theme.ink2;
        return (
          <Pressable
            key={item.key}
            onPress={() => open(item)}
            accessibilityRole={item.kind === "tab" ? "tab" : "button"}
            accessibilityLabel={item.label}
            accessibilityHint={item.hint}
            accessibilityState={item.kind === "tab" ? { selected: active } : undefined}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: active ? theme.accentSoft : pressed && !item.accent ? theme.tint : theme.surfaceClear,
              },
            ]}
          >
            {({ pressed }) => (
              <>
                <View
                  style={[
                    styles.iconWrap,
                    item.accent
                      ? {
                          backgroundColor: theme.accent,
                          opacity: pressed ? pressedOpacity.soft : 1,
                        }
                      : null,
                  ]}
                >
                  <Ionicons name={active ? item.activeIcon : item.icon} size={item.accent ? 18 : 20} color={iconColor} />
                </View>
                <Text numberOfLines={1} style={[styles.label, { color: labelColor }]}>
                  {item.label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: PADDING,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.float,
  },
  item: {
    width: 64,
    height: ITEM_HEIGHT,
    borderRadius: ITEM_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconWrap: {
    width: 32,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.sansSemibold,
    fontSize: typeSize.meta,
    lineHeight: 14,
  },
});
