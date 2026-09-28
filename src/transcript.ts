export type ParagraphTiming = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
};

export type WordTiming = {
  word: string;
  start: number;
  end: number;
  paragraph?: number;
};

/** Paragraph timings derived from word timestamps; falls back to a proportional split. */
export function buildWordTimings(
  body: string[],
  words: WordTiming[],
  durationSec: number,
): ParagraphTiming[] {
  if (body.length === 0) return [];
  if (words.length === 0) return buildTimings(body, durationSec);
  if (words.some((word) => word.paragraph !== undefined)) {
    const timings: ParagraphTiming[] = [];
    body.forEach((text, index) => {
      const owned = words.filter((word) => word.paragraph === index);
      if (owned.length === 0) return;
      timings.push({
        index,
        startSec: owned[0].start,
        endSec: owned[owned.length - 1].end,
        text,
      });
    });
    return timings;
  }
  const timings: ParagraphTiming[] = [];
  let cursor = 0;
  body.forEach((text, index) => {
    const count = Math.max(text.split(/\s+/).filter(Boolean).length, 1);
    const start = words[Math.min(cursor, words.length - 1)].start;
    const end = words[Math.min(cursor + count - 1, words.length - 1)].end;
    timings.push({ index, startSec: start, endSec: end, text });
    cursor += count;
  });
  return timings;
}

export function buildTimings(body: string[], durationSec: number): ParagraphTiming[] {
  if (body.length === 0) return [];
  const totalChars = body.reduce((sum, paragraph) => sum + paragraph.length, 0);
  if (totalChars <= 0 || durationSec <= 0) {
    return body.map((text, index) => ({ index, startSec: 0, endSec: 0, text }));
  }
  const timings: ParagraphTiming[] = [];
  let cursor = 0;
  body.forEach((text, index) => {
    const startSec = cursor;
    const span =
      index === body.length - 1
        ? Math.max(durationSec - startSec, 0)
        : (text.length / totalChars) * durationSec;
    const endSec = startSec + span;
    timings.push({ index, startSec, endSec, text });
    cursor = endSec;
  });
  return timings;
}

export function currentParagraphAt(timings: ParagraphTiming[], t: number): number {
  if (timings.length === 0) return -1;
  for (const timing of timings) {
    if (t < timing.endSec) return timing.index;
  }
  return timings[timings.length - 1].index;
}

export function paragraphProgress(timings: ParagraphTiming[], t: number): number {
  const index = currentParagraphAt(timings, t);
  if (index < 0) return 0;
  const timing = timings[index];
  const span = timing.endSec - timing.startSec;
  if (span <= 0) return 0;
  return Math.min(Math.max((t - timing.startSec) / span, 0), 1);
}
