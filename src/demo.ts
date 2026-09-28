import { useSyncExternalStore } from "react";
import { CAMPUS_LANDMARKS } from "./campusLandmarks";
import { haversineMeters, type LatLng } from "./geo";

type DemoState = {
  enabled: boolean;
  fakePosition: LatLng | null;
};

const listeners = new Set<() => void>();

function setState(next: DemoState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function setDemoEnabled(enabled: boolean): void {
  setState({ ...state, enabled });
}

/** Offset a coordinate by meters north/east, for a fake position near a landmark. */
function offsetMeters(coordinate: LatLng, northM: number, eastM: number): LatLng {
  const metersPerDegree = 111_320;
  return {
    latitude: coordinate.latitude + northM / metersPerDegree,
    longitude:
      coordinate.longitude +
      eastM / (metersPerDegree * Math.cos((coordinate.latitude * Math.PI) / 180)),
  };
}

/**
 * Snap a pressed point to the nearest campus landmark (plus a few metres of
 * jitter) so a long-press anywhere on the map lands inside the 150 m unlock
 * radius of that landmark's notes. Demo only; real positions are never stored.
 */
export function snapToLandmark(position: LatLng): LatLng {
  if (CAMPUS_LANDMARKS.length === 0) return position;
  const nearest = CAMPUS_LANDMARKS.reduce((best, landmark) =>
    haversineMeters(position, landmark.coordinate) < haversineMeters(position, best.coordinate)
      ? landmark
      : best,
  );
  return offsetMeters(nearest.coordinate, 18, 14);
}

function envCoord(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Where the app thinks it is standing when it opens, from EXPO_PUBLIC_DEMO_LAT /
 * EXPO_PUBLIC_DEMO_LNG (inlined at bundle time).
 *
 * This is what makes the demo work away from campus. The server's distance check
 * is never bypassed — `unlock_note` runs `ST_DWithin` regardless of DEMO_MODE —
 * so the app has to actually be somewhere near a landmark for a note to open.
 * Seeding a position puts it there instead of disabling the check. Snapped, so a
 * roughly-typed coordinate still lands inside an unlock radius.
 *
 * Unset (a real build): null, and the app uses live GPS as always.
 */
const seededPosition: LatLng | null = (() => {
  const latitude = envCoord(process.env.EXPO_PUBLIC_DEMO_LAT);
  const longitude = envCoord(process.env.EXPO_PUBLIC_DEMO_LNG);
  if (latitude === null || longitude === null) return null;
  return snapToLandmark({ latitude, longitude });
})();

// With a seeded position the map opens on unlocked notes and needs no hint, so the
// chip stays off. Without one, nothing can unlock until someone moves the position
// by hand — so show the chip, which is the only thing that explains how.
let state: DemoState = { enabled: seededPosition === null, fakePosition: seededPosition };

export function setFakePosition(fakePosition: LatLng | null): void {
  setState({ ...state, fakePosition: fakePosition ? snapToLandmark(fakePosition) : null });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, () => state);
}
