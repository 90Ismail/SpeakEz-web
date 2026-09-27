import { useSyncExternalStore } from "react";
import type { LatLng } from "./geo";

type DemoState = {
  enabled: boolean;
  fakePosition: LatLng | null;
};

let state: DemoState = { enabled: false, fakePosition: null };
const listeners = new Set<() => void>();

function setState(next: DemoState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function setDemoEnabled(enabled: boolean): void {
  setState({ ...state, enabled });
}

export function setFakePosition(fakePosition: LatLng | null): void {
  setState({ ...state, fakePosition });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, () => state);
}
