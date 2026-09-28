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
  reply_count?: number;
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
  paragraph?: number;
};

/** A voice reply in the thread under an original post. */
export type Reply = {
  id: string;
  body: string;
  audioUrl: string | null;
  durationSec: number;
  dayLabel: string;
};

export type UnlockResult = {
  body: string[];
  words: UnlockWord[];
  audioUrl: string | null;
  replies: Reply[];
};

function absoluteMediaUrl(url: string | null | undefined): string | null {
  return url ? new URL(url, API_URL).toString() : null;
}

export async function unlockNote(
  id: string,
  position: { latitude: number; longitude: number },
): Promise<UnlockResult> {
  const data = await request<{
    body: string;
    words: UnlockWord[] | null;
    audio_url: string | null;
    replies?: {
      id: string;
      body: string;
      audio_url: string | null;
      duration_sec: number | null;
      day_label: string;
    }[];
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
    audioUrl: absoluteMediaUrl(data.audio_url),
    replies: (data.replies ?? []).map((reply) => ({
      id: reply.id,
      body: reply.body,
      audioUrl: absoluteMediaUrl(reply.audio_url),
      durationSec: reply.duration_sec ?? 0,
      dayLabel: reply.day_label,
    })),
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
    replyCount: note.reply_count ?? 0,
  }));
}

export type DailyPrompt = {
  id: number | null;
  text: string;
};

/** Today's voice journal prompt. Answers are journal-only; the API never puts them on the map. */
export async function fetchTodayPrompt(): Promise<DailyPrompt> {
  const data = await request<{ id: number; text: string; date: string }>("/prompts/today");
  return { id: data.id, text: data.text };
}
