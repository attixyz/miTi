// Main-thread side of the taste indexing pipeline.
//
// The events store hands every incoming event to `queueEventForIndexing`;
// batches are debounced and posted to the taste Web Worker, which does all
// tokenizing and DB writing off the main thread. This module also keeps a
// session registry of every event seen (latest version per coordinate) so a
// full reindex — element-selection change, edited event detected — can resend
// the complete known set without reaching back into the events store.

import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import type { EventDoc } from "./tokenizer";
import type { TasteWorkerRequest, TasteWorkerResponse } from "./messages";
import { getTasteElementSettings } from "./settings";

/** Fired after the worker changes the corpus — /debug/words listens to reload. */
export const TASTE_CORPUS_CHANGED_EVENT = "miti-taste-corpus-changed";
/** Fired when indexing starts/stops; detail: { indexing: boolean }. */
export const TASTE_STATUS_EVENT = "miti-taste-status";

/** Batches per-event bursts (cache replay, relay trickle) into one worker call. */
const FLUSH_DELAY_MS = 400;

const docRegistry = new Map<string, EventDoc>(); // by coordinate, latest version
const pending = new Map<string, EventDoc>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let worker: Worker | null = null;
let inFlight = 0;
let reindexInFlight = false;

function eventToDoc(event: NDKEvent): EventDoc | null {
  if (event.kind !== 31922 && event.kind !== 31923) return null;
  const metadata = getEventMetadata(event);
  const d: string | undefined = metadata.uuid;
  if (d == null || !event.pubkey || !event.id) return null;
  return {
    id: event.id,
    coordinate: `${event.kind}:${event.pubkey}:${d}`,
    title: metadata.title ?? "",
    tags: (metadata.hashtags ?? []) as string[],
    content: metadata.content ?? "",
    summary: metadata.shortDescription ?? "",
    location: metadata.location ?? "",
  };
}

function broadcastStatus() {
  window.dispatchEvent(
    new CustomEvent(TASTE_STATUS_EVENT, { detail: { indexing: inFlight > 0 } })
  );
}

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./taste.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<TasteWorkerResponse>) => {
      inFlight = Math.max(0, inFlight - 1);
      const msg = e.data;
      if (msg.type === "error") {
        console.error("Taste worker error:", msg.message);
        reindexInFlight = false;
        broadcastStatus();
        return;
      }
      if (msg.mode === "reindex") reindexInFlight = false;
      if (msg.needsReindex) requestFullReindex();
      broadcastStatus();
      if (msg.indexed > 0 || msg.mode === "reindex") {
        window.dispatchEvent(new CustomEvent(TASTE_CORPUS_CHANGED_EVENT));
      }
    };
    worker.onerror = (e) => {
      console.error("Taste worker failed:", e.message);
    };
  }
  return worker;
}

function postToWorker(msg: TasteWorkerRequest) {
  const w = getWorker();
  if (!w) return;
  inFlight++;
  broadcastStatus();
  w.postMessage(msg);
}

function flushPending() {
  if (pending.size === 0) return;
  const docs = [...pending.values()];
  pending.clear();
  postToWorker({ type: "index", docs, settings: getTasteElementSettings() });
}

/**
 * Queue one fetched event for corpus indexing. Cheap and idempotent: the
 * worker skips events it has already counted, so cache replays and re-fetches
 * are safe to queue blindly.
 */
export function queueEventForIndexing(event: NDKEvent) {
  const doc = eventToDoc(event);
  if (!doc) return;
  docRegistry.set(doc.coordinate, doc);
  pending.set(doc.coordinate, doc);
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPending();
  }, FLUSH_DELAY_MS);
}

/**
 * Rebuild the whole corpus from every event seen this session. Triggered by
 * an element-selection change, or by the worker when it detects an edited
 * event / a corpus built under a different selection. If the session has seen
 * few events so far the corpus shrinks accordingly and refills incrementally
 * as fetches stream in — self-healing, never wrong, briefly smaller.
 */
export function requestFullReindex() {
  if (reindexInFlight) return;
  reindexInFlight = true;
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pending.clear(); // superseded — the registry already holds them
  postToWorker({
    type: "reindex",
    docs: [...docRegistry.values()],
    settings: getTasteElementSettings(),
  });
}

/** True while any worker batch is in flight — drives debug-page indicators. */
export function isIndexing(): boolean {
  return inFlight > 0;
}
