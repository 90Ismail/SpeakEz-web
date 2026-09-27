export type LatLng = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function roundTo10(meters: number): number {
  return Math.round(meters / 10) * 10;
}

export function formatDistance(meters: number): string {
  const rounded = roundTo10(meters);
  if (rounded < 1000) return `${rounded} m`;
  return `${(rounded / 1000).toFixed(1)} km`;
}

export function formatDistanceUpper(meters: number): string {
  return formatDistance(meters).toUpperCase();
}

export function dayLabel(date: Date, now: Date = new Date()): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysAgo = Math.floor((startOfToday - date.getTime()) / dayMs) + 1;
  const hour = date.getHours();
  const partOfDay =
    hour < 5 ? "tonight" : hour < 12 ? "this morning" : hour < 17 ? "this afternoon" : hour < 22 ? "this evening" : "tonight";
  if (daysAgo <= 1) return partOfDay;
  if (daysAgo === 2) return "yesterday";
  if (daysAgo < 8) {
    return date.toLocaleDateString(undefined, { weekday: "long" }).toLowerCase();
  }
  return "earlier this month";
}
