import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useState } from "react";

export type StoryPlayer = {
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

const RATES = [1, 1.5, 2] as const;

function nextRate(rate: number): number {
  const index = RATES.indexOf(rate as (typeof RATES)[number]);
  return RATES[(index + 1) % RATES.length];
}

// Seeds have no audio files yet, so playback is a mock clock. When a note
// carries a signed audio_url from /unlock, the expo-audio path takes over.
export function useMockPlayer(durationSec: number): StoryPlayer {
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
    setRate(nextRate);
  }, []);

  return { playing, currentTime, duration: durationSec, rate, toggle, seekTo, skip, cycleRate };
}

/** Real playback through expo-audio when the note has a signed audio URL, else the mock clock. */
export function useNotePlayer(source: string | null, durationSec: number): StoryPlayer {
  const audio = useAudioPlayer(source ? { uri: source } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(audio);
  const mock = useMockPlayer(source ? 0 : durationSec);
  const [rate, setRate] = useState(1);

  const toggle = useCallback(() => {
    if (!source) {
      mock.toggle();
      return;
    }
    if (audio.playing) {
      audio.pause();
      return;
    }
    if (status.didJustFinish || audio.currentTime >= (audio.duration || durationSec) - 0.05) {
      void audio.seekTo(0).then(() => audio.play());
      return;
    }
    audio.play();
  }, [source, audio, mock, status.didJustFinish, durationSec]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!source) {
        mock.seekTo(seconds);
        return;
      }
      void audio.seekTo(Math.min(Math.max(seconds, 0), audio.duration || durationSec));
    },
    [source, audio, mock, durationSec],
  );

  const skip = useCallback(
    (deltaSeconds: number) => {
      if (!source) {
        mock.skip(deltaSeconds);
        return;
      }
      const total = audio.duration || durationSec;
      void audio.seekTo(Math.min(Math.max(audio.currentTime + deltaSeconds, 0), total));
    },
    [source, audio, mock, durationSec],
  );

  const cycleRate = useCallback(() => {
    if (!source) {
      mock.cycleRate();
      return;
    }
    const next = nextRate(rate);
    audio.setPlaybackRate(next);
    setRate(next);
  }, [source, audio, mock, rate]);

  if (!source) return mock;

  return {
    playing: status.playing,
    currentTime: status.currentTime,
    duration: status.duration > 0 ? status.duration : durationSec,
    rate,
    toggle,
    seekTo,
    skip,
    cycleRate,
  };
}
