import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark";

export const fonts = {
  sans: "Karla",
  serif: "Newsreader",
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const type = {
  hero: 40,
  display: 32,
  title: 24,
  heading: 17,
  body: 15,
  support: 13,
  meta: 11,
  reading: 19,
} as const;

export const lineHeight = {
  reading: 27,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  gutter: 24,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const motion = {
  press: 260,
  stretch: 190,
  settle: 420,
  stagger: 22,
} as const;

export type ColorTokens = {
  bg: string;
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  onAccent: string;
  accentWash: string;
  accentLine: string;
  accentClear: string;
  tint: string;
  frost: string;
  glass: string;
  glassStrong: string;
  glassStroke: string;
  glassShadow: string;
  scrim: string;
  danger: string;
  dangerSoft: string;
  waveMuted: string;
  ring: string;
  bgClear: string;
  bgVeil: string;
  surfaceClear: string;
  controlLine: string;
  mapGround: string;
  mapBlock: string;
  mapPark: string;
  mapWater: string;
  mapRoad: string;
  mapLabel: string;
  mapLandmark: string;
  mapPath: string;
  mapTunnel: string;
};

const light: ColorTokens = {
  bg: "#F7F6F3",
  surface: "#FFFFFF",
  ink: "#1C1D1F",
  ink2: "#4A4D52",
  ink3: "#676B71",
  line: "#E2E3DF",
  accent: "#2F7A64",
  accentSoft: "#E4F0EA",
  accentText: "#245E4E",
  onAccent: "#FFFFFF",
  accentWash: "#2F7A641A",
  accentLine: "#2F7A6659",
  accentClear: "#2F7A6400",
  tint: "#1C1D1F0D",
  frost: "#FFFFFF99",
  glass: "#FFFFFFD1",
  glassStrong: "#FAFAF8F0",
  glassStroke: "#1C1D1F14",
  glassShadow: "#1C1D1F1A",
  scrim: "#1C1D1F4D",
  danger: "#A63D33",
  dangerSoft: "#F7E8E5",
  waveMuted: "#C7CACD",
  ring: "#FFFFFF",
  bgClear: "#F7F6F300",
  bgVeil: "#F7F6F3EB",
  surfaceClear: "#FFFFFF00",
  controlLine: "#8D9196",
  mapGround: "#ECEEED",
  mapBlock: "#DFE2E1",
  mapPark: "#DCE6DC",
  mapWater: "#CCDCE4",
  mapRoad: "#FAFAF9",
  mapLabel: "#5F6664",
  mapLandmark: "#D2D8D5",
  mapPath: "#FFFFFF",
  mapTunnel: "#8A938F",
};

const dark: ColorTokens = {
  bg: "#121314",
  surface: "#1B1D1F",
  ink: "#ECEAE6",
  ink2: "#BDBFC2",
  ink3: "#8F9398",
  line: "#2C2F32",
  accent: "#7FBFA6",
  accentSoft: "#1C2B25",
  accentText: "#9FD0BC",
  onAccent: "#0E1A15",
  accentWash: "#7FBFA624",
  accentLine: "#7FBFA666",
  accentClear: "#7FBFA600",
  tint: "#FFFFFF12",
  frost: "#1B1D1F99",
  glass: "#232528C7",
  glassStrong: "#1B1D1FF2",
  glassStroke: "#FFFFFF1F",
  glassShadow: "#00000066",
  scrim: "#00000080",
  danger: "#E59A90",
  dangerSoft: "#2E1C1A",
  waveMuted: "#3B3F43",
  ring: "#121314",
  bgClear: "#12131400",
  bgVeil: "#121314EB",
  surfaceClear: "#1B1D1F00",
  controlLine: "#6A6E73",
  mapGround: "#1A1C1E",
  mapBlock: "#25282B",
  mapPark: "#1C2620",
  mapWater: "#16222B",
  mapRoad: "#2A2D31",
  mapLabel: "#8F9699",
  mapLandmark: "#30353A",
  mapPath: "#343A3E",
  mapTunnel: "#5E6669",
};

export const palette: Record<ThemeMode, ColorTokens> = { light, dark };

let override: ThemeMode | null = null;
const listeners = new Set<() => void>();

export function setThemeOverride(mode: ThemeMode | null): void {
  override = mode;
  listeners.forEach((listener) => listener());
}

export function getThemeOverride(): ThemeMode | null {
  return override;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useThemeMode(): ThemeMode {
  const systemMode: ThemeMode = useColorScheme() === "dark" ? "dark" : "light";
  return useSyncExternalStore(subscribe, () => override ?? systemMode);
}

export function useTheme(): ColorTokens {
  return palette[useThemeMode()];
}
