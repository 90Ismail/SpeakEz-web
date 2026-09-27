import { Text, type StyleProp, type TextStyle } from "react-native";
import { fonts, fontWeight, type, useTheme } from "../theme";

type CapsTone = "ink" | "ink2" | "ink3" | "accent" | "danger";

type CapsProps = {
  children: string;
  tone?: CapsTone;
  size?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function Caps({ children, tone = "ink2", size = type.meta, style, numberOfLines }: CapsProps) {
  const theme = useTheme();
  const colors: Record<CapsTone, string> = {
    ink: theme.ink,
    ink2: theme.ink2,
    ink3: theme.ink3,
    accent: theme.accentText,
    danger: theme.danger,
  };
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: fonts.sans,
          fontSize: size,
          fontWeight: fontWeight.bold,
          letterSpacing: 0.8,
          color: colors[tone],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
