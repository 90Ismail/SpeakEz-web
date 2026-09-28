import { useCallback, useEffect, useState } from "react";

export type MockPlayer = {
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  toggle: () => void;
  seekTo: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  cycleRate: () => void;
};

export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(Math.floor(seconds), 0) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatRate(rate: number): string {
  return `${rate}×`;
}

// TODO(real audio): seeds have no audio files, so playback is a mock clock.
// When a note carries a signed audio_url from /unlock, swap this for an
// expo-audio player that keeps the same MockPlayer shape.
export function useMockPlayer(durationSec: number): MockPlayer {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (!playing || durationSec <= 0) return;
    const id = setInterval(() => {
      setCurrentTime((time) => {
        const next = Math.min(time + 0.25 * rate, durationSec);
        if (next >= durationSec) setPlaying(false);
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playing, rate, durationSec]);

  const toggle = useCallback(() => {
    if (!playing && currentTime >= durationSec) setCurrentTime(0);
    setPlaying(!playing);
  }, [playing, currentTime, durationSec]);

  const seekTo = useCallback(
    (seconds: number) => {
      setCurrentTime(Math.min(Math.max(seconds, 0), durationSec));
    },
    [durationSec],
  );

  const skip = useCallback(
    (deltaSeconds: number) => {
      setCurrentTime((time) => Math.min(Math.max(time + deltaSeconds, 0), durationSec));
    },
    [durationSec],
  );

  const cycleRate = useCallback(() => {
    setRate((value) => (value === 1 ? 1.5 : value === 1.5 ? 2 : 1));
  }, []);

  return { playing, currentTime, duration: durationSec, rate, toggle, seekTo, skip, cycleRate };
}
