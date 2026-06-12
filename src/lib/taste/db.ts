// Taste data store (like-dislike.md, "Data model").
//
// An ENTIRELY SEPARATE Dexie DB — not the NDK Dexie cache, not a table in some
// shared app DB. `ndk-cache-dexie` owns and version-bumps its own schema;
// keeping our data out of it means zero coupling, and wiping/recomputing the
// taste data is a plain DB drop that never touches the event cache.
//
// Opened from both the main thread (debug/settings reads) and the taste Web
// Worker (all indexing writes) — IndexedDB handles the shared access.

import Dexie from "dexie";
import type { Table } from "dexie";

/** One word of the global corpus: weighted frequency + accumulated taste. */
export interface WordRow {
  word: string;
  /** Weighted corpus frequency; feeds idf = log((1+T)/(1+count)). */
  count: number;
  /** Raw cumulative SIGNED sum of taste points; squashed only at ranking time. */
  like_score: number;
}

/**
 * Per-event taste state, keyed by the address coordinate `kind:pubkey:d` — NOT
 * the raw event id, which changes on every organizer edit. Click columns are
 * nullable timestamps (epoch ms): null = never, otherwise the click time gives
 * reverse-chronological /favorites and /hidden for free. Created in Phase 1;
 * rows are written by the feedback delta engine (Phase 2).
 */
export interface EventTasteRow {
  coordinate: string;
  /** Cached, derived aggregate in (-1, 1) — never the source of truth. */
  like_score: number;
  score_calculated_at: number | null;
  clicked_like: number | null;
  clicked_dislike: number | null;
  clicked_report: number | null;
  clicked_hide: number | null;
  last_rsvp_state: "yes" | "maybe" | "no" | null;
  added_to_calendar: number | null;
  /** Stamped on EVERY row change; drives the row-level sync merge (Phase 5). */
  updated_at: number | null;
}

/**
 * Which raw event version each coordinate's counts came from. Lets `index_event`
 * skip already-indexed events (idempotent re-fetches) and detect edited events,
 * whose old words can only be corrected by a full reindex.
 */
export interface IndexedEventRow {
  coordinate: string;
  eventId: string;
  indexedAt: number;
}

export interface MetaRow {
  key: string;
  value: number | string;
}

/** Bookkeeping of the `miti-likes` NIP-78 sync (user-preferences.md). */
export interface SyncMetaRow {
  key: string;
  value: number | string;
}

export const SYNC_META_KEYS = {
  /** taste_version at the last successful publish — the sync dirty gate. */
  likesLastPushedVersion: "likes_last_pushed_version",
  /** created_at (seconds) of the newest remote doc already merged. */
  likesLastAppliedAt: "likes_last_applied_at",
  /** Id of our last published miti-likes event — echo-skip on the live sub. */
  likesLastPublishedId: "likes_last_published_id",
  /**
   * 1 while a merge-triggered replay has been requested but not completed by
   * the worker — re-requested on the next startup so a replay lost to a tab
   * close still happens.
   */
  likesReplayPending: "likes_replay_pending",
} as const;

export const META_KEYS = {
  /** Corpus token total: Σ count over all words. idf needs it. */
  T: "T",
  /** Bumped whenever cached event scores go stale (reindex; later feedback). */
  tasteVersion: "taste_version",
  /**
   * Timestamp of the last invalidation. A cached event score is stale when its
   * score_calculated_at does not strictly exceed this ("predates the last
   * feedback" — like-dislike.md, "Lazy computation").
   */
  tasteInvalidatedAt: "taste_invalidated_at",
  /** Element selection the current corpus was built under. */
  elementsFingerprint: "elements_fingerprint",
} as const;

export class TasteDB extends Dexie {
  words!: Table<WordRow, string>;
  event_taste!: Table<EventTasteRow, string>;
  indexed_events!: Table<IndexedEventRow, string>;
  meta!: Table<MetaRow, string>;
  sync_meta!: Table<SyncMetaRow, string>;

  constructor() {
    super("miti-taste");
    this.version(1).stores({
      words: "word, count",
      // clicked_like indexed for /favorites ordering, updated_at for the sync merge.
      event_taste: "coordinate, clicked_like, updated_at",
      indexed_events: "coordinate",
      meta: "key",
    });
    // Phase 5: the miti-likes sync bookkeeping (user-preferences.md).
    this.version(2).stores({
      sync_meta: "key",
    });
  }
}

let db: TasteDB | null = null;

/** Lazily open the DB; returns null where IndexedDB doesn't exist (SSR). */
export function getTasteDb(): TasteDB | null {
  if (typeof indexedDB === "undefined") return null;
  if (!db) db = new TasteDB();
  return db;
}

export async function getMetaNumber(
  database: TasteDB,
  key: string,
  fallback = 0
): Promise<number> {
  const row = await database.meta.get(key);
  return typeof row?.value === "number" ? row.value : fallback;
}

export async function getSyncMetaNumber(
  database: TasteDB,
  key: string,
  fallback = 0
): Promise<number> {
  const row = await database.sync_meta.get(key);
  return typeof row?.value === "number" ? row.value : fallback;
}

export async function getSyncMetaString(
  database: TasteDB,
  key: string
): Promise<string | null> {
  const row = await database.sync_meta.get(key);
  return typeof row?.value === "string" ? row.value : null;
}

export async function setSyncMeta(
  database: TasteDB,
  key: string,
  value: number | string
): Promise<void> {
  await database.sync_meta.put({ key, value });
}

/** Fired (main thread only) after cached event scores were invalidated. */
export const TASTE_SCORES_STALE_EVENT = "miti-taste-scores-stale";

/**
 * invalidate_scores (like-dislike.md, "Lazy computation"): bump taste_version,
 * stamp the invalidation time, and broadcast so score consumers recompute their
 * visible events. Shared by the feedback engine and the debug knobs (k).
 */
export async function invalidateEventScores(database: TasteDB): Promise<void> {
  const version = await getMetaNumber(database, META_KEYS.tasteVersion);
  await database.meta.put({ key: META_KEYS.tasteVersion, value: version + 1 });
  await database.meta.put({ key: META_KEYS.tasteInvalidatedAt, value: Date.now() });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TASTE_SCORES_STALE_EVENT));
  }
}
