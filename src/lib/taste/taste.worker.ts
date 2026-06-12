// Taste indexing Web Worker (like-dislike.md, "Lazy computation").
//
// All corpus writes happen here so tokenizing a 1000-event batch never
// freezes the UI. The worker owns `index_event` (incremental) and the batch
// reindex (full rebuild); the main thread only reads the DB.

import { getTasteDb, getMetaNumber, META_KEYS, SYNC_META_KEYS } from "./db";
import type { TasteDB, WordRow } from "./db";
import { filteredWords, elementsFingerprint, docWordWeights } from "./tokenizer";
import type { EventDoc, TasteElementSettings } from "./tokenizer";
import type { TasteWorkerRequest, TasteWorkerResponse } from "./messages";
import { idf } from "./scoring";
import { appliedRowPoints } from "./points";

const ctx = self as unknown as { postMessage(message: TasteWorkerResponse): void };

// onmessage handlers are async — serialize them so two batches never
// interleave their read-modify-write cycles on the same word rows.
let chain: Promise<void> = Promise.resolve();

self.onmessage = (e: MessageEvent<TasteWorkerRequest>) => {
  const msg = e.data;
  chain = chain
    .then(() => handle(msg))
    .catch((err) => {
      ctx.postMessage({ type: "error", message: String(err) });
    });
};

async function handle(msg: TasteWorkerRequest): Promise<void> {
  const db = getTasteDb();
  if (!db) {
    ctx.postMessage({ type: "error", message: "IndexedDB unavailable in worker" });
    return;
  }

  if (msg.type === "reindex") {
    await reindexAll(db, msg.docs, msg.settings);
    ctx.postMessage({
      type: "done",
      mode: "reindex",
      indexed: msg.docs.length,
      needsReindex: false,
    });
    return;
  }

  if (msg.type === "replay") {
    const stored = (await db.meta.get(META_KEYS.elementsFingerprint))?.value;
    if (stored !== undefined && stored !== elementsFingerprint(msg.settings)) {
      // The counts were built under another element selection — replaying
      // over them would mix the two. A full rebuild replays anyway.
      await reindexAll(db, msg.docs, msg.settings);
    } else {
      await replayScores(db, msg.docs, msg.settings);
    }
    await db.sync_meta.put({ key: SYNC_META_KEYS.likesReplayPending, value: 0 });
    ctx.postMessage({ type: "done", mode: "replay", indexed: 0, needsReindex: false });
    return;
  }

  const result = await indexBatch(db, msg.docs, msg.settings);
  ctx.postMessage({ type: "done", mode: "index", ...result });
}

/** Σ weight per word for a set of docs, plus the grand total (the T delta). */
function countWords(
  docs: EventDoc[],
  settings: TasteElementSettings
): { counts: Map<string, number>; total: number } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const doc of docs) {
    for (const [word, weight] of filteredWords(doc, settings)) {
      counts.set(word, (counts.get(word) ?? 0) + weight);
      total += weight;
    }
  }
  return { counts, total };
}

/**
 * `index_event`, batched: adds the weighted word counts of never-seen events
 * to the corpus and updates T. Already-indexed events (same coordinate, same
 * event id) are skipped, so re-fetches and cache replays are idempotent.
 */
async function indexBatch(
  db: TasteDB,
  docs: EventDoc[],
  settings: TasteElementSettings
): Promise<{ indexed: number; needsReindex: boolean }> {
  const fingerprint = elementsFingerprint(settings);
  const storedFingerprint = (await db.meta.get(META_KEYS.elementsFingerprint))?.value;
  if (storedFingerprint !== undefined && storedFingerprint !== fingerprint) {
    // Corpus was built under a different element selection — only a full
    // rebuild can fix it; don't mix the two selections.
    return { indexed: 0, needsReindex: true };
  }

  const known = await db.indexed_events.bulkGet(docs.map((d) => d.coordinate));
  const fresh: EventDoc[] = [];
  let needsReindex = false;
  docs.forEach((doc, i) => {
    const row = known[i];
    if (!row) fresh.push(doc);
    // Edited event (new id, same coordinate): the old version's words can't
    // be subtracted — they were never stored — so request a full rebuild.
    else if (row.eventId !== doc.id) needsReindex = true;
  });

  if (fresh.length === 0) return { indexed: 0, needsReindex };

  const { counts, total } = countWords(fresh, settings);

  await db.transaction("rw", db.words, db.indexed_events, db.meta, async () => {
    const wordKeys = [...counts.keys()];
    const existing = await db.words.bulkGet(wordKeys);
    const rows: WordRow[] = wordKeys.map((word, i) => ({
      word,
      count: (existing[i]?.count ?? 0) + (counts.get(word) ?? 0),
      like_score: existing[i]?.like_score ?? 0,
    }));
    await db.words.bulkPut(rows);

    const now = Date.now();
    await db.indexed_events.bulkPut(
      fresh.map((d) => ({ coordinate: d.coordinate, eventId: d.id, indexedAt: now }))
    );

    const t = await getMetaNumber(db, META_KEYS.T);
    await db.meta.put({ key: META_KEYS.T, value: t + total });
    if (storedFingerprint === undefined) {
      await db.meta.put({ key: META_KEYS.elementsFingerprint, value: fingerprint });
    }
  });

  return { indexed: fresh.length, needsReindex };
}

/**
 * Replay the stored feedback rows over freshly rebuilt counts: rebuilds every
 * word's like_score with the CURRENT idf (self-correcting the write-time idf
 * drift — an accepted trade-off in like-dislike.md). Rows whose event isn't
 * in the batch stay dormant; add_to_calendar repeats are lost (documented
 * replay caveat, see points.ts).
 */
function replayFeedback(
  tasteRows: { coordinate: string; points: number }[],
  docsByCoordinate: Map<string, EventDoc>,
  counts: Map<string, number>,
  total: number,
  settings: TasteElementSettings
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const { coordinate, points } of tasteRows) {
    if (points === 0) continue;
    const doc = docsByCoordinate.get(coordinate);
    if (!doc) continue; // dormant: event not (yet) known on this device
    const weights = docWordWeights(doc, settings);
    let totalWeight = 0;
    const idfWeights = new Map<string, number>();
    for (const [word, weight] of weights) {
      const w = weight * idf(counts.get(word) ?? 0, total);
      idfWeights.set(word, w);
      totalWeight += w;
    }
    if (totalWeight <= 0) continue;
    for (const [word, w] of idfWeights) {
      scores.set(word, (scores.get(word) ?? 0) + (points * w) / totalWeight);
    }
  }
  return scores;
}

/**
 * Rebuild every word's like_score from scratch by replaying ALL stored
 * feedback rows over the EXISTING corpus counts (user-preferences.md,
 * "Merging" — run after a sync merge changed event_taste). Unlike a reindex,
 * counts and T stay untouched. Rows whose event is not among the given docs
 * stay dormant until a later replay/reindex knows their doc; a live click
 * racing this rebuild self-corrects the same way — the rows are the truth,
 * every replay rebuilds from them.
 */
async function replayScores(
  db: TasteDB,
  docs: EventDoc[],
  settings: TasteElementSettings
): Promise<void> {
  const docsByCoordinate = new Map(docs.map((d) => [d.coordinate, d]));

  await db.transaction("rw", db.words, db.event_taste, db.meta, async () => {
    const T = await getMetaNumber(db, META_KEYS.T);
    const wordRows = await db.words.toArray();
    const counts = new Map(wordRows.map((r) => [r.word, r.count]));
    const feedback = (await db.event_taste.toArray()).map((row) => ({
      coordinate: row.coordinate,
      points: appliedRowPoints(row),
    }));
    const scores = replayFeedback(feedback, docsByCoordinate, counts, T, settings);

    const changed: WordRow[] = [];
    for (const row of wordRows) {
      const next = scores.get(row.word) ?? 0;
      scores.delete(row.word);
      if (next !== row.like_score) changed.push({ ...row, like_score: next });
    }
    // Words replayed but not counted yet (doc registered, index batch still
    // pending): keep the score on a count-0 row; the batch adds the counts.
    for (const [word, like_score] of scores) {
      if (like_score !== 0) changed.push({ word, count: 0, like_score });
    }
    if (changed.length > 0) await db.words.bulkPut(changed);

    // Cached event scores are stale now. taste_version is NOT bumped: it is
    // the sync dirty flag, and a replay changes no feedback rows.
    await db.meta.put({ key: META_KEYS.tasteInvalidatedAt, value: Date.now() });
  });
}

/**
 * Full rebuild: wipe the corpus, re-count every known event under the current
 * element selection, then rebuild like_score by replaying the feedback rows.
 */
async function reindexAll(
  db: TasteDB,
  docs: EventDoc[],
  settings: TasteElementSettings
): Promise<void> {
  const { counts, total } = countWords(docs, settings);
  const docsByCoordinate = new Map(docs.map((d) => [d.coordinate, d]));

  const feedback = (await db.event_taste.toArray()).map((row) => ({
    coordinate: row.coordinate,
    points: appliedRowPoints(row),
  }));
  const scores = replayFeedback(feedback, docsByCoordinate, counts, total, settings);

  await db.transaction("rw", db.words, db.indexed_events, db.meta, async () => {
    await db.words.clear();
    await db.indexed_events.clear();

    const rows: WordRow[] = [...counts.entries()].map(([word, count]) => ({
      word,
      count,
      like_score: scores.get(word) ?? 0,
    }));
    await db.words.bulkPut(rows);

    const now = Date.now();
    await db.indexed_events.bulkPut(
      docs.map((d) => ({ coordinate: d.coordinate, eventId: d.id, indexedAt: now }))
    );

    await db.meta.put({ key: META_KEYS.T, value: total });
    await db.meta.put({
      key: META_KEYS.elementsFingerprint,
      value: elementsFingerprint(settings),
    });
    // Every cached event score is stale now. (No window here — the main-thread
    // indexer broadcasts TASTE_CORPUS_CHANGED_EVENT when this batch completes.)
    const version = await getMetaNumber(db, META_KEYS.tasteVersion);
    await db.meta.put({ key: META_KEYS.tasteVersion, value: version + 1 });
    await db.meta.put({ key: META_KEYS.tasteInvalidatedAt, value: Date.now() });
  });
}
