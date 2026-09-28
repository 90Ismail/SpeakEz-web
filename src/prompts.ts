import { useEffect, useState } from "react";
import { fetchTodayPrompt, type DailyPrompt } from "./api";

/**
 * Same list and rotation as the API (api/seed.py PROMPTS, services/prompts.py), used
 * only when the API can't be reached so the Journal never shows an empty prompt card.
 */
const OFFLINE_PROMPTS = [
  "What's something you haven't said out loud yet?",
  "Where on campus do you feel most like yourself?",
  "What did today ask of you?",
  "Who do you wish knew how you're really doing?",
  "What's a small thing that went right this week?",
  "What are you carrying that isn't yours to carry?",
  "What would you tell yourself from the first week of school?",
  "What are you looking forward to, even a little?",
  "When did you last feel proud of yourself?",
  "What do you need more of right now?",
  "What's been on your mind on the walk to class?",
  "What would make tomorrow a bit easier?",
];

/** Days since 0001-01-01, like Python's date.toordinal(), for the local calendar day. */
function localOrdinal(now: Date): number {
  const utcMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(utcMidnight / 86_400_000) + 719_163;
}

function offlinePrompt(now = new Date()): DailyPrompt {
  return { id: null, text: OFFLINE_PROMPTS[localOrdinal(now) % OFFLINE_PROMPTS.length] };
}

/** Today's prompt from the API, with the offline rotation as an instant placeholder and fallback. */
export function useTodayPrompt(): DailyPrompt {
  const [prompt, setPrompt] = useState<DailyPrompt>(() => offlinePrompt());
  useEffect(() => {
    let cancelled = false;
    fetchTodayPrompt()
      .then((next) => {
        if (!cancelled) setPrompt(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return prompt;
}
