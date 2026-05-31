"use client";

import { useCallback, useEffect, useState } from "react";
import { useNdk } from "nostr-hooks";
import {
  type NDKEvent,
  type NDKFilter,
  type NDKSubscription,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import { useNovaEvent } from "@/components/nova/event/useNovaEvent";
import { getEventStart } from "@/components/nova/events/useNovaEvents";

/**
 * Loads a single calendar (kind 31924) cache-first via {@link useNovaEvent},
 * then resolves the events it references (upcoming / past) plus the "unapproved"
 * events — those that reference this calendar but aren't yet in its `a` tags.
 *
 * Both lists are read cache-first via `ndk.subscribe` (mirrors the events feed):
 * cached copies paint immediately and relay copies merge in as each relay
 * answers, so a slow relay can't trap the sections in their skeletons. Like the
 * feed, this client path shows referenced events as-is (no per-event NIP-09
 * deletion fetch); the server ICS route still uses the blocking, deletion-aware
 * `fetchCalendarEvents` where correctness matters more than latency.
 */
export function useNovaCalendar(identifier?: string) {
  const { ndk } = useNdk();
  const { event: calendar, status, loading, notFound } = useNovaEvent(identifier);

  const [upcoming, setUpcoming] = useState<NDKEvent[]>([]);
  const [past, setPast] = useState<NDKEvent[]>([]);
  const [unapproved, setUnapproved] = useState<NDKEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!calendar || !ndk || calendar.kind !== 31924) return;

    setEventsLoading(true);
    setUpcoming([]);
    setPast([]);
    setUnapproved([]);

    const now = Math.floor(Date.now() / 1000);
    const startOf = (e: NDKEvent) => getEventStart(e)?.unix() ?? null;

    // Coordinates the calendar approves (its `a` tags).
    const approvedCoords = new Set(
      calendar.tags.filter((t) => t[0] === "a").map((t) => t[1])
    );

    // ── Approved events: one filter per referenced coordinate, cache-first ─────
    const approvedFilters: NDKFilter[] = [];
    for (const coord of approvedCoords) {
      const [kindStr, pubkey, dTag] = coord.split(":");
      const kind = parseInt(kindStr);
      if ((kind !== 31922 && kind !== 31923) || !pubkey) continue;
      approvedFilters.push({
        kinds: [kind as number],
        authors: [pubkey],
        "#d": [dTag ?? ""],
      });
    }

    // Dedup by addressable identity, keeping the newest copy per key.
    const approvedByKey = new Map<string, NDKEvent>();
    const flushApproved = () => {
      const up: NDKEvent[] = [];
      const pa: NDKEvent[] = [];
      for (const e of approvedByKey.values()) {
        const start = startOf(e);
        if (start != null && start > now) up.push(e);
        else pa.push(e);
      }
      up.sort((a, b) => (startOf(a) ?? 0) - (startOf(b) ?? 0));
      pa.sort((a, b) => (startOf(b) ?? 0) - (startOf(a) ?? 0));
      setUpcoming(up);
      setPast(pa);
    };

    // ── Unapproved: events that reference this calendar but aren't in `a` ──────
    const dTag = calendar.tags.find((t) => t[0] === "d")?.[1];
    const coordinate = dTag ? `31924:${calendar.pubkey}:${dTag}` : null;
    const pendingByKey = new Map<string, NDKEvent>();

    let approvedSub: NDKSubscription | undefined;
    let unapprovedSub: NDKSubscription | undefined;
    try {
      if (approvedFilters.length > 0) {
        approvedSub = ndk.subscribe(approvedFilters, {
          closeOnEose: true,
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        approvedSub.on("event", (incoming: NDKEvent) => {
          const key = incoming.deduplicationKey();
          const existing = approvedByKey.get(key);
          if (
            !existing ||
            (incoming.created_at ?? 0) >= (existing.created_at ?? 0)
          ) {
            approvedByKey.set(key, incoming);
            flushApproved();
          }
          setEventsLoading(false);
        });
        approvedSub.on("eose", () => setEventsLoading(false));
      }

      if (coordinate) {
        unapprovedSub = ndk.subscribe(
          { kinds: [31922 as number, 31923 as number], "#a": [coordinate] },
          { closeOnEose: true, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }
        );
        unapprovedSub.on("event", (incoming: NDKEvent) => {
          const d = incoming.tags.find((t) => t[0] === "d")?.[1];
          const coord = d ? `${incoming.kind}:${incoming.pubkey}:${d}` : null;
          if (!coord || approvedCoords.has(coord)) return; // already approved
          const key = incoming.deduplicationKey();
          const existing = pendingByKey.get(key);
          if (
            !existing ||
            (incoming.created_at ?? 0) >= (existing.created_at ?? 0)
          ) {
            pendingByKey.set(key, incoming);
            setUnapproved(Array.from(pendingByKey.values()));
          }
        });
      }
    } catch (e) {
      console.error("Failed to subscribe to calendar events", e);
      setEventsLoading(false);
      return;
    }

    // A calendar with no approved refs has nothing to wait on; otherwise cap the
    // skeleton so an empty cache + silent relays can't trap it.
    if (approvedFilters.length === 0) setEventsLoading(false);
    const fallback = setTimeout(() => setEventsLoading(false), 8000);

    return () => {
      clearTimeout(fallback);
      approvedSub?.stop();
      unapprovedSub?.stop();
    };
  }, [calendar, ndk, reloadKey]);

  return {
    calendar,
    status,
    loading,
    notFound,
    upcoming,
    past,
    unapproved,
    eventsLoading,
    reload,
  };
}
