import { authenticatedFetch } from "../session";
import { API_URL } from "../config";

export type CreateNoteInput = {
  audioUri: string;
  landmarkId: string | null;
  durationSec: number;
  visibility?: "public" | "journal";
  promptId?: number | null;
  accessToken?: string;
};

export type CreateNoteResponse = {
  noteId: string;
};

export type DraftWord = {
  word: string;
  start: number;
  end: number;
  paragraph?: number;
};

export type DraftResult = {
  id: string;
  status: "processing" | "draft" | "held" | "blocked" | string;
  title: string | null;
  body: string | null;
  words: DraftWord[] | null;
  visibility: string;
};

export type PublishResult = {
  id: string;
  status: string;
  liveWithinMinutes: number;
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
  form.append("landmark_id", input.landmarkId ?? "");
  form.append("duration_sec", String(Math.max(1, Math.round(input.durationSec))));
  form.append("visibility", input.visibility ?? "public");
  if (input.promptId != null) form.append("prompt_id", String(input.promptId));

  const payload = await readResponse(
    await authenticatedFetch(endpoint("/notes"), {
      method: "POST",
      headers: headers(input.accessToken),
      body: form,
    }),
  );

  if (!payload || typeof payload !== "object") {
    throw new RecordUploadError("The API did not return a note ID.");
  }

  const noteId =
    "id" in payload && typeof payload.id === "string"
      ? payload.id
      : "note_id" in payload && typeof payload.note_id === "string"
        ? payload.note_id
        : "noteId" in payload && typeof payload.noteId === "string"
          ? payload.noteId
          : null;
  if (!noteId) throw new RecordUploadError("The API did not return a note ID.");
  return { noteId };
}

export async function submitNote(noteId: string, accessToken?: string): Promise<void> {
  await readResponse(
    await authenticatedFetch(endpoint(`/notes/${encodeURIComponent(noteId)}/submit`), {
      method: "POST",
      headers: headers(accessToken),
    }),
  );
}

export type CreateReplyInput = {
  audioUri: string;
  parentId: string;
  durationSec: number;
  accessToken?: string;
};

/** Upload a voice reply: always public, at the original post's place, never on the map alone. */
export async function createReply(input: CreateReplyInput): Promise<CreateNoteResponse> {
  const form = new FormData();
  const file = audioFileFor(input.audioUri);
  form.append(
    "audio",
    { uri: input.audioUri, name: file.name, type: file.type } as unknown as Blob,
  );
  form.append("duration_sec", String(Math.max(1, Math.round(input.durationSec))));

  const payload = await readResponse(
    await authenticatedFetch(endpoint(`/notes/${encodeURIComponent(input.parentId)}/replies`), {
      method: "POST",
      headers: headers(input.accessToken),
      body: form,
    }),
  );
  if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string") {
    throw new RecordUploadError("The API did not return a note ID.");
  }
  return { noteId: payload.id };
}

/** The author's own note after processing: status, title, transcript and word timings. */
export async function fetchDraft(noteId: string, accessToken?: string): Promise<DraftResult> {
  const payload = await readResponse(
    await authenticatedFetch(endpoint(`/notes/${encodeURIComponent(noteId)}/draft`), {
      method: "GET",
      headers: headers(accessToken),
    }),
  );
  if (!payload || typeof payload !== "object") {
    throw new RecordUploadError("The API did not return a draft.");
  }
  return payload as DraftResult;
}

/** Schedule an approved public draft to go live. Demo mode makes `liveWithinMinutes` zero. */
export async function publishNote(
  noteId: string,
  title: string | null,
  accessToken?: string,
): Promise<PublishResult> {
  const payload = await readResponse(
    await authenticatedFetch(endpoint(`/notes/${encodeURIComponent(noteId)}/publish`), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers(accessToken) },
      body: JSON.stringify(title ? { title } : {}),
    }),
  );
  if (!payload || typeof payload !== "object") {
    throw new RecordUploadError("The API did not confirm the publish.");
  }
  const result = payload as { id: string; status: string; live_within_minutes?: number };
  return {
    id: result.id,
    status: result.status,
    liveWithinMinutes: result.live_within_minutes ?? 0,
  };
}
