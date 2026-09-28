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

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

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
    throw new ApiError(response.status, `SpeakEz API ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

export type UnlockWord = {
  word: string;
  start: number;
  end: number;
};

export type UnlockResult = {
  body: string[];
  words: UnlockWord[];
  audioUrl: string | null;
};

export async function unlockNote(
  id: string,
  position: { latitude: number; longitude: number },
): Promise<UnlockResult> {
  const data = await request<{
    body: string;
    words: UnlockWord[] | null;
    audio_url: string | null;
  }>(`/notes/${id}/unlock`, {
    method: "POST",
    body: JSON.stringify({ lat: position.latitude, lng: position.longitude }),
  });
  return {
    body: data.body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0),
    words: data.words ?? [],
    audioUrl: data.audio_url ? new URL(data.audio_url, API_URL).toString() : null,
  };
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
