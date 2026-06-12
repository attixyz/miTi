// Algorithmic "this looks like spam / an incomplete event" signals
// (like-dislike.md, /hidden → "Reason: short_text, high_spam_score"). These are
// derived PURELY from the event — no user action involved — and power both the
// /spam filter page and the shared feed visibility gate (visibility.ts), which
// hides flagged events from /list and /map. The signals are independent: an
// event can trip one, the other, or both. The taste-score signal
// (low_like_score) lives in `scores.ts` (HIDDEN_SCORE_THRESHOLD); this module
// owns the content signal.

import { tokenize } from "./tokenizer";

/**
 * An event's main text counts as "short" (low-effort / incomplete) when it has
 * fewer than this many MEANINGFUL words. `tokenize` has already stripped
 * numbers, URLs, emoji and punctuation, so 7 meaningful words ≈ 8–10 raw words
 * — the "less than 7–10 words" band from the spec. Tunable.
 */
export const SHORT_TEXT_MIN_WORDS = 7;

/** Count of meaningful words in an event's main text (`event.content`). */
export function mainTextWordCount(content: string): number {
  return [...tokenize(content)].length;
}

/** True when the main text is empty or shorter than SHORT_TEXT_MIN_WORDS. */
export function isShortText(content: string): boolean {
  return mainTextWordCount(content) < SHORT_TEXT_MIN_WORDS;
}
