import { CAMPUS_LANDMARKS, type CampusLandmark } from "./campusLandmarks";
import { haversineMeters, type LatLng } from "./geo";

export type ZoneId = "east" | "west";

export type CampusZone = {
  id: ZoneId;
  label: string;
  center: LatLng;
  radiusM: number;
};

export const ZONES: CampusZone[] = [
  { id: "east", label: "EAST BANK ZONE", center: { latitude: 44.975, longitude: -93.2335 }, radiusM: 800 },
  { id: "west", label: "WEST BANK ZONE", center: { latitude: 44.9712, longitude: -93.244 }, radiusM: 420 },
];

export function zoneAt(position: LatLng): CampusZone | null {
  const containing = ZONES.filter((zone) => haversineMeters(position, zone.center) <= zone.radiusM);
  if (containing.length === 0) return null;
  return containing.reduce((nearest, zone) =>
    haversineMeters(position, zone.center) < haversineMeters(position, nearest.center) ? zone : nearest,
  );
}

export function landmarkInZone(zone: CampusZone, position: LatLng): CampusLandmark | undefined {
  return CAMPUS_LANDMARKS.filter((landmark) => landmark.bank === zone.id).reduce<CampusLandmark | undefined>(
    (nearest, landmark) =>
      !nearest || haversineMeters(position, landmark.coordinate) < haversineMeters(position, nearest.coordinate)
        ? landmark
        : nearest,
    undefined,
  );
}

/**
 * Named places the map header can say it's "near", checked in order, so the small
 * neighbourhoods win over the big bank zones they overlap. Centre + radius, like ZONES.
 */
export type MapArea = {
  id: string;
  /** Header eyebrow, already in caps. */
  label: string;
  center: LatLng;
  radiusM: number;
};

const NEIGHBOURHOODS: MapArea[] = [
  { id: "dinkytown", label: "NEAR DINKYTOWN", center: { latitude: 44.9812, longitude: -93.2358 }, radiusM: 320 },
  { id: "stadium-village", label: "NEAR STADIUM VILLAGE", center: { latitude: 44.9737, longitude: -93.223 }, radiusM: 350 },
  { id: "st-paul", label: "NEAR ST. PAUL CAMPUS · UMN", center: { latitude: 44.9857, longitude: -93.183 }, radiusM: 900 },
];

const BANK_LABELS: Record<ZoneId, string> = {
  east: "NEAR EAST BANK · UMN",
  west: "NEAR WEST BANK · UMN",
};

export const OUTSIDE_CAMPUS_LABEL = "UMN · MINNEAPOLIS";

/** Where the map is looking: a neighbourhood, else a bank zone, else null (off campus). */
export function areaAt(position: LatLng): MapArea | null {
  const neighbourhood = NEIGHBOURHOODS.find((area) => haversineMeters(position, area.center) <= area.radiusM);
  if (neighbourhood) return neighbourhood;
  const zone = zoneAt(position);
  return zone ? { id: zone.id, label: BANK_LABELS[zone.id], center: zone.center, radiusM: zone.radiusM } : null;
}
