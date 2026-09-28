import { API_URL } from "../config";

export type CreateNoteInput = {
  audioUri: string;
  landmarkId: string;
  durationSec: number;
  accessToken?: string;
};

export type CreateNoteResponse = {
  noteId: string;
};

export class RecordUploadError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "RecordUploadError";
    this.status = status;
  }
}

function endpoint(path: string): string {
  return `${API_URL.replace(/\/+$/, "")}${path}`;
}

function headers(accessToken?: string): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function audioFileFor(uri: string): { name: string; type: string } {
  const path = uri.split("?")[0] ?? uri;
  const extension = path.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "m4a";
  const mimeType =
    extension === "wav"
      ? "audio/wav"
      : extension === "caf"
        ? "audio/x-caf"
        : extension === "mp3"
          ? "audio/mpeg"
          : "audio/mp4";
  return { name: `recording.${extension}`, type: mimeType };
}

async function readResponse(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!response.ok) {
    let detail = body;
    try {
      const payload = JSON.parse(body) as { detail?: unknown };
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {
      // Keep the response text when the API did not return JSON.
    }
    throw new RecordUploadError(
      detail || `Request failed with status ${response.status}`,
      response.status,
    );
  }
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new RecordUploadError("The API returned an invalid response.", response.status);
  }
}

export async function createNote(input: CreateNoteInput): Promise<CreateNoteResponse> {
  const form = new FormData();
  const file = audioFileFor(input.audioUri);

  form.append(
    "audio",
    {
      uri: input.audioUri,
      name: file.name,
      type: file.type,
    } as unknown as Blob,
  );
  form.append("landmark_id", input.landmarkId);
  form.append("duration_sec", String(Math.max(1, Math.round(input.durationSec))));

  const payload = await readResponse(
    await fetch(endpoint("/notes"), {
      method: "POST",
      headers: headers(input.accessToken),
      body: form,
    }),
  );

  if (!payload || typeof payload !== "object") {
    throw new RecordUploadError("The API did not return a note ID.");
  }

  const noteId =
    "note_id" in payload && typeof payload.note_id === "string"
      ? payload.note_id
      : "noteId" in payload && typeof payload.noteId === "string"
        ? payload.noteId
        : null;
  if (!noteId) throw new RecordUploadError("The API did not return a note ID.");
  return { noteId };
}

export async function submitNote(noteId: string, accessToken?: string): Promise<void> {
  await readResponse(
    await fetch(endpoint(`/notes/${encodeURIComponent(noteId)}/submit`), {
      method: "POST",
      headers: headers(accessToken),
    }),
  );
}
