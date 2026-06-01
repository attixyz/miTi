"use client";

import { useState, useEffect, useMemo } from "react";
import { useNdk } from "nostr-hooks";
import { type NDKEvent, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import dayjs from "dayjs";
import { getEventStart } from "@/components/nova/events/useNovaEvents";
import { useEventCoordinates } from "./useEventCoordinates";
import { useFilters } from "@/providers/FiltersContext";

/** An event that has been resolved to a coordinate and can be pinned on the map. */
export interface MapEvent {
  event: NDKEvent;
  lat: number;
  lon: number;
  /** "geohash" = decoded instantly from the `g` tag; "geocode" = Nominatim. */
  source: "geohash" | "geocode";
}

/**
 * Data layer for the map view. Fetches upcoming events (same query as the list),
 * filters to the selected day, then resolves each to a coordinate via the shared
 * {@link useEventCoordinates} hook. The map shows every placeable event
 * worldwide — geographic filtering now lives in the app-wide location filter
 * (see FiltersContext), which only the /list view applies; the map merely
 * centers on the chosen coordinates.
 */
export function useNovaMapEvents() {
  const { ndk } = useNdk();
  // `selectedDay` lives in FiltersContext so it persists when switching between
  // /map and /list (see FiltersContext).
  const { selectedDay, setSelectedDay } = useFilters();
  const [allEvents, setAllEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch upcoming events (mirrors the list view, cache-first) ──────────────
  useEffect(() => {
    if (!ndk) return;

    setLoading(true);
    setAllEvents([]);

    const now = Math.floor(Date.now() / 1000);
    const todayStart = dayjs().startOf("day");

    // Dedup by addressable identity: the cache and each relay can deliver the
    // same event, and replaceable events (31922/31923) arrive in multiple
    // versions. `deduplicationKey()` returns `kind:pubkey:d`; keep the newest.
    const byKey = new Map<string, NDKEvent>();

    const flush = () => {
      const upcoming = Array.from(byKey.values())
        .filter((e) => {
          const start = getEventStart(e);
          return start && !start.isBefore(todayStart);
        })
        .sort((a, b) => {
          const aStart = getEventStart(a);
          const bStart = getEventStart(b);
          if (!aStart) return 1;
          if (!bStart) return -1;
          return aStart.valueOf() - bStart.valueOf();
        });
      setAllEvents(upcoming);
    };

    let sub;
    try {
      sub = ndk.subscribe(
        {
          kinds: [31922 as any, 31923 as any],
          since: now - 30 * 24 * 3600,
          limit: 1000,
        },
        { closeOnEose: true, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }
      );
    } catch (e) {
      console.error("Failed to subscribe to events", e);
      setLoading(false);
      return;
    }

    // Cached events emit first (CACHE_FIRST), so pins paint before any relay
    // answers; relay events merge in as each relay responds. A slow relay can
    // no longer freeze the page in the skeleton — it just contributes late.
    sub.on("event", (incoming: NDKEvent) => {
      const key = incoming.deduplicationKey();
      const existing = byKey.get(key);
      if (
        !existing ||
        (incoming.created_at ?? 0) >= (existing.created_at ?? 0)
      ) {
        byKey.set(key, incoming);
        flush();
      }
      setLoading(false);
    });

    sub.on("eose", () => setLoading(false));

    // Safety net: never stay in the skeleton forever if the cache is empty and
    // every relay stays silent.
    const fallback = setTimeout(() => setLoading(false), 8000);

    return () => {
      clearTimeout(fallback);
      sub.stop();
    };
  }, [ndk]);

  const dayEvents = useMemo(() => {
    const selected = dayjs(selectedDay);
    return allEvents.filter((e) => {
      const start = getEventStart(e);
      return start && start.isSame(selected, "day");
    });
  }, [allEvents, selectedDay]);

  const { coordsById, resolving } = useEventCoordinates(dayEvents);

  const mapEvents = useMemo<MapEvent[]>(() => {
    return dayEvents.flatMap((event) => {
      const c = coordsById[event.id];
      if (!c) return [];
      return [{ event, lat: c.lat, lon: c.lon, source: c.source }];
    });
  }, [dayEvents, coordsById]);

  return {
    loading,
    resolving,
    selectedDay,
    setSelectedDay,
    dayEventCount: dayEvents.length,
    mappedCount: mapEvents.length,
    mapEvents,
  };
}
