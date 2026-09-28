import type { LatLng } from "./geo";

/** A live note as the app shows it: map pin, voice card, story header. */
export type MapNote = {
  id: string;
  title: string;
  landmarkId: string;
  landmarkName: string;
  coordinate: LatLng;
  durationSec: number;
  dayLabel: string;
};
