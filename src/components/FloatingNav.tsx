import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { pressed as pressedOpacity, radius, shadow, useTheme } from "../theme";

type TabRoute = "/" | "/saved";
type PushRoute = "/record" | "/profile";

type NavItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: TabRoute | PushRoute;
  /** Tabs switch in place; pushed routes stack on top (record flow, profile drawer). */
  kind: "tab" | "push";
  accent: boolean;
};

const ITEMS: NavItem[] = [
  { key: "map", icon: "map-outline", label: "Map", route: "/", kind: "tab", accent: false },
  { key: "saved", icon: "bookmark-outline", label: "Saved audio", route: "/saved", kind: "tab", accent: false },
  { key: "record", icon: "mic", label: "Record a voice note", route: "/record", kind: "push", accent: true },
  { key: "you", icon: "person-circle-outline", label: "You", route: "/profile", kind: "push", accent: false },
];

type FloatingNavProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Floating Nav from the design: frost pill with a hairline glass stroke and the
 * float shadow. Map and Saved are tabs (active = accentSoft disc + accentText
 * icon); Record is the accent disc; You opens the profile drawer and never
 * reads as active. Pressed items show a tint disc.
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
        const color = item.accent ? theme.onAccent : active ? theme.accentText : theme.ink;
        return (
          <Pressable
            key={item.key}
            onPress={() => open(item)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: item.accent
                  ? theme.accent
                  : active
                    ? theme.accentSoft
                    : pressed
                      ? theme.tint
                      : theme.surfaceClear,
                opacity: item.accent && pressed ? pressedOpacity.soft : 1,
              },
            ]}
          >
            <Ionicons name={item.icon} size={20} color={color} />
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
    gap: 4,
    padding: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.float,
  },
  item: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
