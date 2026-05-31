"use client";

import { useState, useEffect, useMemo } from "react";
import { useNdk } from "nostr-hooks";
import { type NDKEvent, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { useFilters } from "@/providers/FiltersContext";
import { useEventCoordinates } from "@/components/nova/map/useEventCoordinates";
import { calculateDistance } from "@/utils/location/locationUtils";
import dayjs from "dayjs";

// Stable empty array so passing "nothing to resolve" doesn't churn the
// coordinate hook's effect on every render.
const NO_EVENTS: NDKEvent[] = [];

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

export function useNovaEvents() {
  const { ndk } = useNdk();
  const { location, radiusKm } = useFilters();
  const [allEvents, setAllEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(
    dayjs().format("YYYY-MM-DD")
  );
  const [activeTags, setActiveTags] = useState<string[]>([]);

  useEffect(() => {
    if (!ndk) return;

    setLoading(true);
    setAllEvents([]);

    const now = Math.floor(Date.now() / 1000);
    const todayStart = dayjs().startOf("day");

    // Dedup by addressable identity: the cache and each relay can deliver the
    // same event, and replaceable events (31922/31923) arrive in multiple
    // versions. `deduplicationKey()` returns `kind:pubkey:d` for these kinds;
    // we keep the newest copy per key.
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

    // Cached events emit first (CACHE_FIRST), so the list paints before any
    // relay answers; relay events then merge in as each relay responds. A slow
    // relay can no longer block the render — it just contributes late.
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

  const daysWithEvents = useMemo(() => {
    const days = new Set<string>();
    allEvents.forEach((e) => {
      const start = getEventStart(e);
      if (start) days.add(start.format("YYYY-MM-DD"));
    });
    return days;
  }, [allEvents]);

  const dayEvents = useMemo(() => {
    const selected = dayjs(selectedDay);
    return allEvents.filter((e) => {
      const start = getEventStart(e);
      return start && start.isSame(selected, "day");
    });
  }, [allEvents, selectedDay]);

  // App-wide location filter: when a location is set with a concrete radius
  // ("Any distance" = null skips this), keep only the day's events within that
  // radius. Coordinates resolve via the shared hook (geohash decode + cached
  // Nominatim); events whose coordinate hasn't resolved yet — or can't be —
  // are excluded while the filter is active, so the list fills in progressively.
  // Only resolve coordinates while a filter is active, so the unfiltered list
  // never triggers Nominatim traffic it doesn't need.
  const locationActive = location != null && radiusKm != null;
  const { coordsById, resolving } = useEventCoordinates(
    locationActive ? dayEvents : NO_EVENTS
  );

  const geoEvents = useMemo(() => {
    if (!locationActive || !location || radiusKm == null) return dayEvents;
    const origin = { latitude: location.lat, longitude: location.lon };
    return dayEvents.filter((e) => {
      const c = coordsById[e.id];
      if (!c) return false;
      return (
        calculateDistance(origin, { latitude: c.lat, longitude: c.lon }) <=
        radiusKm
      );
    });
  }, [dayEvents, coordsById, locationActive, location, radiusKm]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    geoEvents.forEach((e) => {
      getEventMetadata(e).hashtags.forEach((tag: string) =>
        tags.add(tag.toLowerCase())
      );
    });
    return Array.from(tags).sort();
  }, [geoEvents]);

  const filteredEvents = useMemo(() => {
    if (activeTags.length === 0) return geoEvents;
    return geoEvents.filter((e) => {
      const eventTags = getEventMetadata(e).hashtags.map((t: string) =>
        t.toLowerCase()
      );
      return activeTags.some((tag) => eventTags.includes(tag));
    });
  }, [geoEvents, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return {
    loading,
    filteredEvents,
    availableTags,
    activeTags,
    toggleTag,
    selectedDay,
    setSelectedDay,
    daysWithEvents,
    totalCount: allEvents.length,
    // Location filter status (consumed by the page for a header line).
    locationActive,
    locationLabel: location?.label ?? null,
    radiusKm,
    // Still geocoding some of the day's events while a location filter is on.
    locationResolving: locationActive && resolving,
  };
}
