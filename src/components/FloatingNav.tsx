import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, useTheme } from "../theme";

type NavItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: "/saved" | "/record" | "/";
  accent: boolean;
};

const ITEMS: NavItem[] = [
  { key: "saved", icon: "bookmark-outline", label: "Saved audio", route: "/saved", accent: false },
  { key: "record", icon: "mic", label: "Record a voice note", route: "/record", accent: true },
  { key: "map", icon: "map-outline", label: "Map", route: "/", accent: false },
];

type FloatingNavProps = {
  style?: StyleProp<ViewStyle>;
};

export function FloatingNav({ style }: FloatingNavProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.container,
        {
          backgroundColor: theme.glass,
          borderColor: theme.glassStroke,
          shadowColor: theme.glassShadow,
        },
        style,
      ]}
    >
      {ITEMS.map((item) => {
        const active = item.route === "/" ? pathname === "/" : pathname.startsWith(item.route);
        const background = item.accent ? theme.accent : active ? theme.accentSoft : theme.surfaceClear;
        const color = item.accent ? theme.onAccent : active ? theme.accentText : theme.ink;
        return (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.route)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.item,
              { backgroundColor: background, opacity: pressed ? 0.75 : 1 },
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
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  item: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
