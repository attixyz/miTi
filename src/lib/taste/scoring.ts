// Corpus math (like-dislike.md, "Scoring and ranking"). Built with the
// feedback engine (Phase 2) because the write-time point split already needs
// idf; squash/event_score join in Phase 3.

/**
 * Corpus rarity of a word: log of the corpus token total T over the word's
 * weighted count (inverse collection frequency, not textbook log(N/df)).
 * ~0 for ubiquitous words, larger for rare ones; never negative. The +1
 * smoothing keeps count = 0 (unseen) and count = 1 well-defined.
 */
export function idf(count: number, T: number): number {
  return Math.log((1 + T) / (1 + count));
}
