"use client";

// App-wide events store. Module-level (not React context) on purpose: pages
// subscribe via useSyncExternalStore, so a data update only re-renders the
// components that read the snapshot — never the whole provider subtree.
//
// One NDK subscription feeds both /list and /map (they always ran the identical
// query). The dedup map and sorted snapshot survive navigation, so a remounting
// page renders synchronously from memory — no skeleton, no relay round-trip.
// Relays are only re-queried when the data is older than STALE_MS or when the
// user explicitly refreshes; a re-fetch skips the Dexie cache (ONLY_RELAY)
// because everything the cache had is already in memory.

import { useSyncExternalStore } from "react";
import {
  type NDKEvent,
  type NDKSubscription,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import dayjs from "dayjs";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { queueEventForIndexing } from "@/lib/taste/indexer";

export function getEventStart(event: NDKEvent): dayjs.Dayjs | null {
  const metadata = getEventMetadata(event);
  if (!metadata.start) return null;

  if (event.kind === 31922) {
    const d = dayjs(metadata.start);
    return d.isValid() ? d : null;
  }

  const ts = parseInt(metadata.start);
  if (isNaN(ts)) return null;
  return dayjs.unix(ts);
}

export interface EventsSnapshot {
  /** Upcoming events, deduped and sorted by start time. */
  events: NDKEvent[];
  /** True only until the first fetch produces anything — drives skeletons. */
  loading: boolean;
  /** True while any fetch is in flight — drives the refresh-button spinner. */
  fetching: boolean;
  /** When the last fetch reached EOSE on the relays; null = never completed. */
  lastFetchedAt: number | null;
}

/** Re-query relays only when the last completed fetch is older than this. */
const STALE_MS = 60 * 60 * 1000; // 1 hour
/** Batches per-event bursts (cache replay, relay trickle) into one re-sort. */
const FLUSH_DELAY_MS = 50;
/** Unblock the UI if the cache is empty and every relay stays silent. */
const SILENT_TIMEOUT_MS = 8000;

// Dedup by addressable identity (`kind:pubkey:d`), newest version wins. The
// start timestamp is computed once on insert so a flush sorts plain numbers
// instead of constructing dayjs objects inside the comparator — the old
// per-event re-sort was O(n² log n) dayjs constructions and froze the page.
const byKey = new Map<string, { event: NDKEvent; start: number }>();
const listeners = new Set<() => void>();

const INITIAL_SNAPSHOT: EventsSnapshot = {
  events: [],
  loading: true,
  fetching: false,
  lastFetchedAt: null,
};
let snapshot = INITIAL_SNAPSHOT;

let activeSub: NDKSubscription | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let silentTimer: ReturnType<typeof setTimeout> | null = null;

function setSnapshot(patch: Partial<EventsSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

function rebuildEvents(): NDKEvent[] {
  const todayStart = dayjs().startOf("day").valueOf();
  return Array.from(byKey.values())
    .filter((e) => e.start >= todayStart)
    .sort((a, b) => a.start - b.start)
    .map((e) => e.event);
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    setSnapshot({ events: rebuildEvents(), loading: false });
  }, FLUSH_DELAY_MS);
}

function handleIncoming(incoming: NDKEvent) {
  const start = getEventStart(incoming)?.valueOf();
  if (start == null) return; // unschedulable — neither view can show it

  const key = incoming.deduplicationKey();
  const existing = byKey.get(key);
  if (existing) {
    if (existing.event.id === incoming.id) return; // exact duplicate
    if ((incoming.created_at ?? 0) < (existing.event.created_at ?? 0)) return;
  }
  byKey.set(key, { event: incoming, start });
  // Feed the taste corpus (like-dislike.md). Sits after the dedup checks so
  // exact duplicates and stale versions never reach the indexer; the worker
  // additionally skips events it has already counted across sessions.
  queueEventForIndexing(incoming);
  scheduleFlush();
}

function clearSilentTimer() {
  if (silentTimer != null) {
    clearTimeout(silentTimer);
    silentTimer = null;
  }
}

function startFetch(ndk: NDK) {
  activeSub?.stop();
  activeSub = null;
  clearSilentTimer();

  // The first fill drains the Dexie cache too; afterwards memory already holds
  // everything the cache had, so a re-fetch only needs the relays.
  const cacheUsage =
    byKey.size > 0
      ? NDKSubscriptionCacheUsage.ONLY_RELAY
      : NDKSubscriptionCacheUsage.CACHE_FIRST;

  const now = Math.floor(Date.now() / 1000);
  let sub: NDKSubscription;
  try {
    sub = ndk.subscribe(
      {
        kinds: [31922 as any, 31923 as any],
        since: now - 30 * 24 * 3600,
        limit: 1000,
      },
      { closeOnEose: true, cacheUsage }
    );
  } catch (e) {
    console.error("Failed to subscribe to events", e);
    setSnapshot({ loading: false, fetching: false });
    return;
  }

  activeSub = sub;
  setSnapshot({ fetching: true });

  sub.on("event", handleIncoming);

  sub.on("eose", () => {
    if (activeSub !== sub) return; // superseded by a newer fetch
    activeSub = null;
    clearSilentTimer();
    // Only a completed fetch counts as fresh.
    setSnapshot({ loading: false, fetching: false, lastFetchedAt: Date.now() });
  });

  // Safety net: relays never answered. Unblock the UI but leave the
  // subscription open so stragglers still merge in; `lastFetchedAt` stays
  // unset, so the next page mount retries.
  silentTimer = setTimeout(() => {
    silentTimer = null;
    if (activeSub === sub) setSnapshot({ loading: false, fetching: false });
  }, SILENT_TIMEOUT_MS);
}

/**
 * Called by the consuming hooks on mount: fetch only when nothing is in flight
 * and the data is missing or stale. A fresh store renders from memory with
 * zero relay traffic.
 */
export function ensureFreshEvents(ndk: NDK) {
  if (snapshot.fetching) return;
  if (
    snapshot.lastFetchedAt != null &&
    Date.now() - snapshot.lastFetchedAt < STALE_MS
  ) {
    return;
  }
  startFetch(ndk);
}

/** Forced re-query (the refresh buttons), regardless of staleness. */
export function refreshEvents(ndk: NDK) {
  if (snapshot.fetching) return;
  startFetch(ndk);
}

function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;
// Stable server/hydration snapshot: matches the initial client state, so SSR
// renders the same skeleton the client hydrates with.
const getServerSnapshot = () => INITIAL_SNAPSHOT;

export function useEventsStore(): EventsSnapshot {
  return useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
}
