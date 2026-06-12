"use client";

// Feedback delta engine (like-dislike.md, "Recording feedback (delta model)").
//
// Every action is recorded as a DELTA from the previously applied state, never
// a blind add: liking twice counts once, switching an RSVP yes→no moves the
// contribution 300→30, like and dislike retract each other. The delta is
// split across the event's words in proportion to weight · idf(word) — a
// fixed pool where rare, distinctive words absorb most of the points.
//
// The module also keeps an in-memory mirror of the event_taste rows (same
// useSyncExternalStore pattern as eventsStore) so buttons render their state
// synchronously and hidden events drop out of lists without a DB round-trip.

import { useSyncExternalStore } from "react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { getTasteDb, getMetaNumber, invalidateEventScores, META_KEYS } from "./db";
import type { EventTasteRow, TasteDB } from "./db";
import { docWordWeights } from "./tokenizer";
import type { EventDoc } from "./tokenizer";
import { getTasteElementSettings } from "./settings";
import { idf } from "./scoring";
import { eventToDoc } from "./indexer";
import { ACTION_POINTS, reactionState, reactionPoints, rsvpPoints } from "./points";
import type { ReactionState, TasteRsvpState } from "./points";

export type { ReactionState, TasteRsvpState } from "./points";

// ---------------------------------------------------------------------------
// In-memory mirror of event_taste (small: only events the user acted on).

type TasteSnapshot = ReadonlyMap<string, EventTasteRow>;

const EMPTY_SNAPSHOT: TasteSnapshot = new Map();
let snapshot: TasteSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();
let hydration: Promise<void> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function setRowInSnapshot(row: EventTasteRow) {
  const next = new Map(snapshot);
  next.set(row.coordinate, row);
  snapshot = next;
  notify();
}

/** Load the persisted rows once; in-memory rows win on conflict (newer). */
function ensureHydrated(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    const db = getTasteDb();
    if (!db) return;
    const persisted = await db.event_taste.toArray();
    const next = new Map(persisted.map((row) => [row.coordinate, row]));
    for (const [coordinate, row] of snapshot) next.set(coordinate, row);
    snapshot = next;
    notify();
  })();
  return hydration;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void ensureHydrated();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY_SNAPSHOT;

/** All taste rows, keyed by coordinate. Reactive to every feedback action. */
export function useTasteRows(): TasteSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The taste row of one event (by `kind:pubkey:d` coordinate), if any. */
export function useEventTaste(coordinate: string | null): EventTasteRow | undefined {
  const rows = useTasteRows();
  return coordinate ? rows.get(coordinate) : undefined;
}

/** Address coordinate of an event as the taste tables key it. */
export function eventCoordinate(event: NDKEvent): string | null {
  return eventToDoc(event)?.coordinate ?? null;
}

// ---------------------------------------------------------------------------
// Delta engine.

function newRow(coordinate: string): EventTasteRow {
  return {
    coordinate,
    like_score: 0,
    score_calculated_at: null,
    clicked_like: null,
    clicked_dislike: null,
    clicked_report: null,
    clicked_hide: null,
    last_rsvp_state: null,
    added_to_calendar: null,
    updated_at: null,
  };
}

// Serialize feedback operations: two near-simultaneous clicks must not
// interleave their read-modify-write of the same row and word scores.
let opChain: Promise<void> = Promise.resolve();

function enqueue(op: () => Promise<void>): Promise<void> {
  const result = opChain.then(op, op);
  opChain = result.catch(() => {});
  return result;
}

/**
 * Distribute a point delta across the event's words: a fixed pool split in
 * proportion to weight · idf(word), so rare words absorb most of an action's
 * points and ubiquitous words almost none.
 */
async function applyWordDelta(db: TasteDB, doc: EventDoc, delta: number): Promise<void> {
  if (delta === 0) return;
  const weights = docWordWeights(doc, getTasteElementSettings());
  if (weights.size === 0) return;

  await db.transaction("rw", db.words, db.meta, async () => {
    const T = await getMetaNumber(db, META_KEYS.T);
    const words = [...weights.keys()];
    const rows = await db.words.bulkGet(words);
    const idfWeights = words.map(
      (word, i) => (weights.get(word) ?? 0) * idf(rows[i]?.count ?? 0, T)
    );
    const totalWeight = idfWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) return; // no scorable words (all idf ~0)

    await db.words.bulkPut(
      words.map((word, i) => ({
        word,
        count: rows[i]?.count ?? 0,
        like_score: (rows[i]?.like_score ?? 0) + (delta * idfWeights[i]) / totalWeight,
      }))
    );
  });
}

/** Persist the row, mirror it in memory, and stamp updated_at — every change. */
async function putRow(db: TasteDB, row: EventTasteRow): Promise<void> {
  row.updated_at = Date.now();
  await db.event_taste.put(row);
  setRowInSnapshot(row);
}

/** invalidate_scores: bump taste_version; event scores recompute lazily. */
async function invalidateScores(db: TasteDB): Promise<void> {
  await invalidateEventScores(db);
}

async function loadRow(db: TasteDB, coordinate: string): Promise<EventTasteRow> {
  await ensureHydrated();
  const cached = snapshot.get(coordinate);
  if (cached) return { ...cached };
  return (await db.event_taste.get(coordinate)) ?? newRow(coordinate);
}

/**
 * Set the like/dislike reaction (null retracts). Mutually exclusive pair:
 * setting one retracts the other — a single delta new − old covers both.
 * Recording an already-applied state is a no-op (never double-counts).
 */
export function setReaction(event: NDKEvent, next: ReactionState): Promise<void> {
  return enqueue(async () => {
    const doc = eventToDoc(event);
    const db = getTasteDb();
    if (!doc || !db) return;
    const row = await loadRow(db, doc.coordinate);
    const current = reactionState(row);
    if (current === next) return;

    await applyWordDelta(db, doc, reactionPoints(next) - reactionPoints(current));
    const now = Date.now();
    row.clicked_like = next === "like" ? now : null;
    row.clicked_dislike = next === "dislike" ? now : null;
    await putRow(db, row);
    await invalidateScores(db);
  });
}

/**
 * Record the RSVP state for taste (null retracts). Retractable state:
 * switching yes→no moves the contribution 300→30, not adds another 30.
 */
export function setRsvpTaste(event: NDKEvent, next: TasteRsvpState): Promise<void> {
  return enqueue(async () => {
    const doc = eventToDoc(event);
    const db = getTasteDb();
    if (!doc || !db) return;
    const row = await loadRow(db, doc.coordinate);
    if (row.last_rsvp_state === next) return;

    await applyWordDelta(db, doc, rsvpPoints(next) - rsvpPoints(row.last_rsvp_state));
    row.last_rsvp_state = next;
    await putRow(db, row);
    await invalidateScores(db);
  });
}

/** Report — the moderation red flag. One-shot: applied once, never repeated. */
export function recordReport(event: NDKEvent): Promise<void> {
  return enqueue(async () => {
    const doc = eventToDoc(event);
    const db = getTasteDb();
    if (!doc || !db) return;
    const row = await loadRow(db, doc.coordinate);
    if (row.clicked_report != null) return;

    await applyWordDelta(db, doc, ACTION_POINTS.report);
    row.clicked_report = Date.now();
    await putRow(db, row);
    await invalidateScores(db);
  });
}

/**
 * Add-to-calendar — the deliberately imperfect signal: the app only sees the
 * click, so every click is a full delta (tolerated over-count, never a wrong
 * sign). The timestamp is informational, not an idempotency gate.
 */
export function recordAddToCalendar(event: NDKEvent): Promise<void> {
  return enqueue(async () => {
    const doc = eventToDoc(event);
    const db = getTasteDb();
    if (!doc || !db) return;
    const row = await loadRow(db, doc.coordinate);

    await applyWordDelta(db, doc, ACTION_POINTS.add_to_calendar);
    row.added_to_calendar = Date.now();
    await putRow(db, row);
    await invalidateScores(db);
  });
}

/** Hide carries NO point value — it only removes the event from view. */
export function setHidden(event: NDKEvent, hidden: boolean): Promise<void> {
  const coordinate = eventCoordinate(event);
  return coordinate ? setHiddenByCoordinate(coordinate, hidden) : Promise.resolve();
}

/**
 * Hide/unhide by coordinate alone. Safe without the event because hiding moves
 * no points; `setHidden` delegates here. Toggled from the card's hide button —
 * red when hidden, a second tap un-hides (e.g. the /your-feedback hidden tab).
 */
export function setHiddenByCoordinate(coordinate: string, hidden: boolean): Promise<void> {
  return enqueue(async () => {
    const db = getTasteDb();
    if (!db) return;
    const row = await loadRow(db, coordinate);
    if ((row.clicked_hide != null) === hidden) return;

    row.clicked_hide = hidden ? Date.now() : null;
    await putRow(db, row); // no points, no score invalidation
  });
}

/** True when the user removed this event from view: hidden or reported. */
export function isRemovedFromView(row: EventTasteRow | undefined): boolean {
  return row != null && (row.clicked_hide != null || row.clicked_report != null);
}

/**
 * merge_taste (user-preferences.md, "Merging"): row-level last-write-wins on
 * updated_at. A remote row that is strictly newer (or unknown here) replaces
 * the whole local row — never merged field-by-field, so like/dislike
 * exclusivity and RSVP consistency cannot be violated; rows present locally
 * only are kept as-is. Runs on the same op chain as the click handlers, so a
 * click can never interleave with a merge. Returns whether anything changed —
 * the caller (likesSync) then invalidates scores and requests the replay.
 */
export function mergeRemoteTasteRows(remote: EventTasteRow[]): Promise<boolean> {
  let changed = false;
  return enqueue(async () => {
    const db = getTasteDb();
    if (!db || remote.length === 0) return;
    await ensureHydrated();

    const winners: EventTasteRow[] = [];
    for (const incoming of remote) {
      const local = snapshot.get(incoming.coordinate);
      if (local && (local.updated_at ?? 0) >= (incoming.updated_at ?? 0)) continue;
      winners.push({
        ...incoming,
        // The local cached score stays as stale-but-usable; it recomputes
        // lazily once the post-merge replay invalidates it.
        like_score: local?.like_score ?? 0,
        score_calculated_at: null,
      });
    }
    if (winners.length === 0) return;

    await db.event_taste.bulkPut(winners);
    const next = new Map(snapshot);
    for (const row of winners) next.set(row.coordinate, row);
    snapshot = next;
    notify();
    changed = true;
  }).then(() => changed);
}
