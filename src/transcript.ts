export type ParagraphTiming = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
};

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
