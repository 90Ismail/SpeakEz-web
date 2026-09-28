import { API_URL } from "./config";
import type { MapNote } from "./notes";

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type ApiLandmark = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type ApiMapNote = {
  id: string;
  title: string | null;
  landmark: ApiLandmark;
  duration_sec: number | null;
  day_label: string;
};

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`SpeakEz API ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

export async function fetchMapNotes(bounds: MapBounds): Promise<MapNote[]> {
  const bbox = [bounds.west, bounds.south, bounds.east, bounds.north]
    .map((value) => value.toFixed(5))
    .join(",");
  const data = await request<{ notes: ApiMapNote[] }>(`/map?bbox=${bbox}`);
  return data.notes.map((note) => ({
    id: note.id,
    title: note.title ?? "Untitled voice note",
    landmarkId: note.landmark.id,
    landmarkName: note.landmark.name,
    coordinate: { latitude: note.landmark.lat, longitude: note.landmark.lng },
    durationSec: note.duration_sec ?? 0,
    dayLabel: note.day_label,
  }));
}
