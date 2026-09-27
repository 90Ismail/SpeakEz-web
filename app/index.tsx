import { StyleSheet, Text, View } from "react-native";
import { fonts, fontWeight, type, useTheme } from "../src/theme";

export default function MapScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.ink }]}>SpeakEz</Text>
      <Text style={[styles.body, { color: theme.ink3 }]}>Map screen in progress</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontFamily: fonts.serif, fontSize: type.display, fontWeight: fontWeight.regular },
  body: { fontFamily: fonts.sans, fontSize: type.body, fontWeight: fontWeight.regular },
});
