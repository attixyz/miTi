"use client";

// Lazy event-score computation (like-dislike.md, "Scoring and ranking" +
// "Lazy computation").
//
// A feedback click only bumps taste_version / taste_invalidated_at; nothing is
// recomputed eagerly. Routes call `useEventScores` with the events they are
// about to render — the working set — and only the ones whose
// score_calculated_at predates the last invalidation are recomputed, cached
// back into event_taste, and stamped. Work stays bounded to "events visible",
// never the whole corpus.

import { useEffect, useState } from "react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import {
  getTasteDb,
  getMetaNumber,
  META_KEYS,
  TASTE_SCORES_STALE_EVENT,
} from "./db";
import type { EventTasteRow } from "./db";
import { docWordWeights } from "./tokenizer";
import type { EventDoc } from "./tokenizer";
import { getTasteElementSettings } from "./settings";
import { idf, squash } from "./scoring";
import { eventToDoc, TASTE_CORPUS_CHANGED_EVENT } from "./indexer";
import { getK } from "./tunables";

/**
 * An event counts as spam/hidden when its like_score falls under this
 * (like-dislike.md: there is no separate spam_score — this IS the spam signal).
 */
export const HIDDEN_SCORE_THRESHOLD = -0.3;

function freshScoreRow(coordinate: string, score: number, at: number): EventTasteRow {
  return {
    coordinate,
    like_score: score,
    score_calculated_at: at,
    clicked_like: null,
    clicked_dislike: null,
    clicked_report: null,
    clicked_hide: null,
    last_rsvp_state: null,
    added_to_calendar: null,
    updated_at: null, // a cached score is not a user action — nothing to sync
  };
}

/**
 * event_score for every given event, lazily: cached values that postdate the
 * last invalidation are returned as-is; stale ones are recomputed (the
 * weighted mean of each word's squashed like_score by weight · idf), persisted
 * to event_taste, and stamped. Returns coordinate → score in (-1, 1).
 */
export async function ensureEventScores(
  events: NDKEvent[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const db = getTasteDb();
  if (!db || events.length === 0) return result;

  const byCoordinate = new Map<string, EventDoc>();
  for (const event of events) {
    const doc = eventToDoc(event);
    if (doc) byCoordinate.set(doc.coordinate, doc);
  }
  const coordinates = [...byCoordinate.keys()];
  if (coordinates.length === 0) return result;

  // Captured BEFORE reading any word data: if feedback lands mid-computation,
  // its invalidation stamp will be >= this, so our rows come out stale and the
  // broadcast triggers another pass — never a fresh-looking pre-feedback score.
  const calculatedAt = Date.now();
  const invalidatedAt = await getMetaNumber(db, META_KEYS.tasteInvalidatedAt, 0);

  const rows = await db.event_taste.bulkGet(coordinates);
  const stale: EventDoc[] = [];
  rows.forEach((row, i) => {
    if (row?.score_calculated_at != null && row.score_calculated_at > invalidatedAt) {
      result.set(coordinates[i], row.like_score);
    } else {
      stale.push(byCoordinate.get(coordinates[i])!);
    }
  });
  if (stale.length === 0) return result;

  const settings = getTasteElementSettings();
  const k = getK();
  const T = await getMetaNumber(db, META_KEYS.T);

  // One bulk read for the union of words across all stale events.
  const docWeights = stale.map((doc) => docWordWeights(doc, settings));
  const allWords = [...new Set(docWeights.flatMap((w) => [...w.keys()]))];
  const wordRows = await db.words.bulkGet(allWords);
  const wordByKey = new Map(allWords.map((word, i) => [word, wordRows[i]]));

  const computed = stale.map((doc, i) => {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [word, weight] of docWeights[i]) {
      const row = wordByKey.get(word);
      const w = weight * idf(row?.count ?? 0, T);
      weightedSum += squash(row?.like_score ?? 0, k) * w;
      totalWeight += w;
    }
    // 0 when the event has no scorable words (all idf ~0, or nothing indexed).
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    result.set(doc.coordinate, score);
    return { coordinate: doc.coordinate, score };
  });

  // Cache. Field-level updates only — a concurrent feedback write to the same
  // row must never be clobbered — and updated_at is NOT stamped: the cached
  // score is derived data, not a taste change for the sync merge (Phase 5).
  await db.transaction("rw", db.event_taste, async () => {
    for (const { coordinate, score } of computed) {
      const updated = await db.event_taste.update(coordinate, {
        like_score: score,
        score_calculated_at: calculatedAt,
      });
      if (updated === 0) {
        await db.event_taste
          .add(freshScoreRow(coordinate, score, calculatedAt))
          .catch(() => {}); // row appeared in between — its score is stale, fine
      }
    }
  });

  return result;
}

const EMPTY_SCORES: ReadonlyMap<string, number> = new Map();

function mapsEqual(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>) {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false;
  }
  return true;
}

/**
 * Reactive coordinate → like_score map for the given events. Recomputes when
 * feedback invalidates the cache or the worker changes the corpus. Callers
 * should pass a memoized array.
 */
export function useEventScores(events: NDKEvent[]): ReadonlyMap<string, number> {
  const [scores, setScores] = useState(EMPTY_SCORES);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void ensureEventScores(events).then((next) => {
        if (cancelled) return;
        setScores((prev) => (mapsEqual(prev, next) ? prev : next));
      });
    };
    run();
    window.addEventListener(TASTE_SCORES_STALE_EVENT, run);
    window.addEventListener(TASTE_CORPUS_CHANGED_EVENT, run);
    return () => {
      cancelled = true;
      window.removeEventListener(TASTE_SCORES_STALE_EVENT, run);
      window.removeEventListener(TASTE_CORPUS_CHANGED_EVENT, run);
    };
  }, [events]);

  return scores;
}

/** Score of one event from a useEventScores map; 0 when unknown/unscored. */
export function scoreOf(
  scores: ReadonlyMap<string, number>,
  coordinate: string | null
): number {
  return (coordinate ? scores.get(coordinate) : undefined) ?? 0;
}
