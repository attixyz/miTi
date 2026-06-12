// Corpus math (like-dislike.md, "Scoring and ranking" and "Combined score
// for /suggested"). Pure module — shared by the main thread and the worker.

/**
 * Corpus rarity of a word: log of the corpus token total T over the word's
 * weighted count (inverse collection frequency, not textbook log(N/df)).
 * ~0 for ubiquitous words, larger for rare ones; never negative. The +1
 * smoothing keeps count = 0 (unseen) and count = 1 well-defined.
 */
export function idf(count: number, T: number): number {
  return Math.log((1 + T) / (1 + count));
}

/** Slope of `squash`; tunable in /debug/tanh-function. */
export const DEFAULT_K = 0.02;

/**
 * Maps an unbounded signed word score into (-1, 1): likes push up, dislikes
 * pull down, a neutral (0) word contributes 0. tanh, not a logistic sigmoid —
 * the sigmoid maps 0 → 0.5 and can never go negative.
 */
export function squash(score: number, k: number): number {
  return Math.tanh(k * score);
}

/** The five /suggested knobs, adjustable in /debug/suggested. */
export interface SuggestedKnobs {
  /** Exponent weights: a larger one punishes harder when its factor is low. */
  wTaste: number;
  wProx: number;
  wSoon: number;
  /** Half-score distance: an event d0Km away scores proximity 0.5. */
  d0Km: number;
  /** Half-score horizon: an event t0Days out scores soonness 0.5. */
  t0Days: number;
}

export const SUGGESTED_DEFAULTS: SuggestedKnobs = {
  wTaste: 2, // taste counts double; distance and date equally
  wProx: 1,
  wSoon: 1,
  d0Km: 25,
  t0Days: 7,
};

/**
 * Combined ranking score for /suggested: taste, proximity and soonness, each
 * normalized into (0, 1] BEFORE its exponent is applied, then multiplied — so
 * a near-zero factor sinks the whole product (a soft veto) and an even
 * exponent can never flip a negative taste positive.
 *
 * `distanceKm` null means "no distance to measure" (no user location set):
 * proximity becomes 1 for every event, a constant factor that drops out of
 * the ranking.
 */
export function suggestedScore(
  eventScore: number,
  distanceKm: number | null,
  daysUntilStart: number,
  knobs: SuggestedKnobs
): number {
  const taste = (1 + eventScore) / 2; // (-1, 1) → (0, 1)
  const proximity = distanceKm == null ? 1 : 1 / (1 + distanceKm / knobs.d0Km);
  const soonness = 1 / (1 + Math.max(0, daysUntilStart) / knobs.t0Days);
  return taste ** knobs.wTaste * proximity ** knobs.wProx * soonness ** knobs.wSoon;
}
