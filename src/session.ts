import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { API_URL } from "./config";

type Tokens = { access: string; refresh: string };
type State = { version: number; ready: boolean; signedIn: boolean; demo: boolean; error: string | null };
const storageKey = "speakez.session.v1";
let tokens: Tokens | null = null;
let state: State = { version: 0, ready: false, signedIn: false, demo: false, error: null };
let generation = 0;
let refreshPending: Promise<void> | null = null;
const listeners = new Set<() => void>();
function update(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}
export function useSession() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => state);
}

async function errorFor(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(typeof body?.detail === "string" ? body.detail : "Unable to sign in. Please try again.");
}
async function post(path: string, body: unknown): Promise<Response> {
  const response = await fetch(`${API_URL}/auth/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) throw await errorFor(response);
  return response;
}
export async function initializeSession(): Promise<void> {
  update({ ready: false, error: null });
  try {
    const response = await fetch(`${API_URL}/auth/config`);
    if (!response.ok) throw new Error("Could not connect to SpeakEz. Check your connection and try again.");
    const config = await response.json() as { demo_mode: boolean };
    const stored = await SecureStore.getItemAsync(storageKey);
    let saved: unknown = null;
    try { saved = stored ? JSON.parse(stored) : null; }
    catch { await SecureStore.deleteItemAsync(storageKey); }
    tokens = saved && typeof saved === "object" && "access" in saved && "refresh" in saved
      && typeof saved.access === "string" && typeof saved.refresh === "string" ? saved as Tokens : null;
    update({ ready: true, signedIn: tokens !== null, demo: config.demo_mode === true });
  } catch {
    update({ error: "Could not connect to SpeakEz. Check your connection and try again." });
  }
}
export async function sendCode(email: string): Promise<void> {
  await post("start", { email });
}
export async function verifyCode(email: string, code: string, over18: boolean): Promise<void> {
  const next = await (await post("verify", { email, code, over18 })).json() as Tokens;
  await SecureStore.setItemAsync(storageKey, JSON.stringify(next));
  generation += 1;
  tokens = next;
  update({ signedIn: true, version: generation });
}
export async function signOut(): Promise<void> {
  if (refreshPending) await refreshPending;
  const old = tokens;
  // Revoke first so a successful sign-out cannot leave a reusable refresh token.
  if (old) await post("logout", { refresh: old.refresh });
  await SecureStore.deleteItemAsync(storageKey);
  tokens = null;
  update({ signedIn: false, version: ++generation });
}
async function refreshSession(): Promise<void> {
  if (refreshPending) return refreshPending;
  const current = tokens;
  if (!current) return;
  const started = generation;
  refreshPending = (async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: current.refresh }),
    });
    if (started !== generation) return;
    if (!response.ok) {
      if (response.status === 401) {
        await SecureStore.deleteItemAsync(storageKey);
        tokens = null;
        update({ signedIn: false, version: ++generation });
      }
      throw await errorFor(response);
    }
    const next = await response.json() as Tokens;
    if (started !== generation) return;
    await SecureStore.setItemAsync(storageKey, JSON.stringify(next));
    tokens = next;
  })().finally(() => { refreshPending = null; });
  return refreshPending;
}

/** Shared by JSON and multipart requests; retry expired sessions once without changing bodies. */
export async function authenticatedFetch(url: string, init?: RequestInit): Promise<Response> {
  const usedToken = tokens?.access;
  const run = () => {
    const headers = new Headers(init?.headers);
    if (tokens) headers.set("Authorization", `Bearer ${tokens.access}`);
    return fetch(url, { ...init, headers });
  };
  const response = await run();
  if (response.status !== 401 || !tokens) return response;
  // Another request may already have renewed the session while this one was in flight.
  if (tokens.access === usedToken) await refreshSession();
  if (!tokens) return response;
  return run();
}
