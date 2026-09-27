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
