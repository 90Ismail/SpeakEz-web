import type { LatLng } from "./geo";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

/** Public URL judges scan to open the app (web build or Expo Go link). Blank falls back to a deep link. */
export const DEMO_URL = process.env.EXPO_PUBLIC_DEMO_URL ?? "";

export const UNLOCK_RADIUS_M = 150;
export const CHIP_RADIUS_M = 450;
export const SHORT_WALK_M = 400;

export const USE_GOOGLE_ON_IOS = false;

export const CAMPUS_CENTER: LatLng = { latitude: 44.9739, longitude: -93.2385 };

export const DEFAULT_CAMERA = {
  ...CAMPUS_CENTER,
  latitudeDelta: 0.016,
  longitudeDelta: 0.028,
};
