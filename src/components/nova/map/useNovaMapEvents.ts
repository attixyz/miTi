"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNdk } from "nostr-hooks";
import { type NDKEvent, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import dayjs from "dayjs";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { getEventStart } from "@/components/nova/events/useNovaEvents";
import { decodeGeohash } from "@/utils/location/geohash";
import {
  geocodeLocation,
  normalizeLocationKey,
} from "@/utils/location/geocodeCache";
import {
  calculateDistance,
  getCurrentLocation,
} from "@/utils/location/locationUtils";

/** An event that has been resolved to a coordinate and can be pinned on the map. */
export interface MapEvent {
  event: NDKEvent;
  lat: number;
  lon: number;
  /** "geohash" = decoded instantly from the `g` tag; "geocode" = Nominatim. */
  source: "geohash" | "geocode";
}

/** The point the radius filter measures from (geolocation or a searched place). */
export interface MapCenter {
  lat: number;
  lon: number;
  label: string;
}

interface ResolvedCoord {
  lat: number;
  lon: number;
  source: "geohash" | "geocode";
}

/**
 * Data layer for the map view. Fetches upcoming events (same query as the list),
 * filters to the selected day, then resolves each event to a coordinate:
 *   1. the `g` geohash tag is decoded synchronously (instant pins), and
 *   2. events with only a `location` string are geocoded via the cached,
 *      rate-limited Nominatim helper, so pins fill in progressively.
 * Only the selected day's events are geocoded, which keeps Nominatim traffic low.
 *
 * A radius filter measures the Haversine distance from a center point (set by
 * browser geolocation or a location search) and hides events outside it.
 */
export function useNovaMapEvents() {
  const { ndk } = useNdk();
  const [allEvents, setAllEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(
    dayjs().format("YYYY-MM-DD")
  );

  // eventId -> resolved coord, or null when the event can't be placed.
  const [coordsById, setCoordsById] = useState<
    Record<string, ResolvedCoord | null>
  >({});
  // Events we've already started resolving — avoids re-attempting on every pass.
  const attemptedRef = useRef<Set<string>>(new Set());
  // Serial geocode queue for location-string events, drained by a persistent
  // worker. Now that events stream in incrementally (cache-first), new work is
  // appended here rather than restarting (and stranding) an in-flight lookup.
  const geocodeQueueRef = useRef<
    { key: string; query: string; ids: string[] }[]
  >([]);
  const geocodeRunningRef = useRef(false);

  const [center, setCenter] = useState<MapCenter | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

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

  // Drains the geocode queue one entry at a time (Nominatim is rate-limited and
  // IndexedDB-cached, so repeat lookups resolve instantly). A single persistent
  // worker means the incremental event stream just appends work — it never
  // restarts the loop, so an in-flight lookup can't be cancelled and stranded.
  const drainGeocodeQueue = useCallback(() => {
    if (geocodeRunningRef.current) return;
    geocodeRunningRef.current = true;
    (async () => {
      try {
        while (geocodeQueueRef.current.length > 0) {
          const { query, ids } = geocodeQueueRef.current.shift()!;
          const coords = await geocodeLocation(query);
          const resolved: ResolvedCoord | null = coords
            ? { lat: coords.lat, lon: coords.lon, source: "geocode" }
            : null;
          setCoordsById((prev) => {
            const next = { ...prev };
            for (const id of ids) next[id] = resolved;
            return next;
          });
        }
      } finally {
        geocodeRunningRef.current = false;
      }
    })();
  }, []);

  // ── Resolve coordinates for the selected day's events ───────────────────────
  // Geohash `g` tags decode synchronously (instant pins); location strings are
  // enqueued for the serial geocoder above. Each event is attempted once
  // (attemptedRef), so the incremental stream only ever appends new work.
  useEffect(() => {
    const syncUpdates: Record<string, ResolvedCoord | null> = {};

    for (const e of dayEvents) {
      if (attemptedRef.current.has(e.id)) continue;
      attemptedRef.current.add(e.id);

      const meta = getEventMetadata(e);

      if (meta.geohash) {
        try {
          const { latitude, longitude } = decodeGeohash(meta.geohash);
          syncUpdates[e.id] = { lat: latitude, lon: longitude, source: "geohash" };
          continue;
        } catch {
          // fall through to the location string below
        }
      }

      if (meta.location) {
        // Group events sharing a location so we geocode it once. Only entries
        // still queued are matched; an item already shifted into the worker is
        // gone from the array, so a duplicate just queues a fast cache hit.
        const key = normalizeLocationKey(meta.location);
        const queued = geocodeQueueRef.current.find((q) => q.key === key);
        if (queued) queued.ids.push(e.id);
        else
          geocodeQueueRef.current.push({
            key,
            query: meta.location,
            ids: [e.id],
          });
      } else {
        syncUpdates[e.id] = null;
      }
    }

    if (Object.keys(syncUpdates).length > 0) {
      setCoordsById((prev) => ({ ...prev, ...syncUpdates }));
    }

    drainGeocodeQueue();
  }, [dayEvents, drainGeocodeQueue]);

  // ── Derived collections ─────────────────────────────────────────────────────
  const mapEvents = useMemo<MapEvent[]>(() => {
    return dayEvents.flatMap((event) => {
      const c = coordsById[event.id];
      if (!c) return [];
      return [{ event, lat: c.lat, lon: c.lon, source: c.source }];
    });
  }, [dayEvents, coordsById]);

  const visibleEvents = useMemo<MapEvent[]>(() => {
    if (!center || radiusKm == null) return mapEvents;
    return mapEvents.filter(
      (me) =>
        calculateDistance(
          { latitude: center.lat, longitude: center.lon },
          { latitude: me.lat, longitude: me.lon }
        ) <= radiusKm
    );
  }, [mapEvents, center, radiusKm]);

  // True while some of the day's events are still awaiting a coordinate.
  const resolving = useMemo(
    () => dayEvents.some((e) => !(e.id in coordsById)),
    [dayEvents, coordsById]
  );

  // ── Center / radius controls ────────────────────────────────────────────────
  const setCenterFromPicked = useCallback(
    (picked: { label: string; lat: number; lon: number } | null) => {
      if (!picked) {
        setCenter(null);
        return;
      }
      setCenter({ label: picked.label, lat: picked.lat, lon: picked.lon });
      setRadiusKm((r) => (r == null ? 25 : r));
    },
    []
  );

  const locate = useCallback(async () => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const { latitude, longitude } = await getCurrentLocation();
      setCenter({ label: "Your location", lat: latitude, lon: longitude });
      setRadiusKm((r) => (r == null ? 25 : r));
    } catch {
      setGeoError("Couldn't access your location");
    } finally {
      setGeoLoading(false);
    }
  }, []);

  return {
    loading,
    resolving,
    selectedDay,
    setSelectedDay,
    daysWithEvents,
    dayEventCount: dayEvents.length,
    mappedCount: mapEvents.length,
    mapEvents,
    visibleEvents,
    center,
    setCenterFromPicked,
    radiusKm,
    setRadiusKm,
    locate,
    geoLoading,
    geoError,
  };
}
