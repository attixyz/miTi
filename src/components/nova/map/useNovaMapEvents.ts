"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNdk } from "nostr-hooks";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
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

  const [center, setCenter] = useState<MapCenter | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // ── Fetch upcoming events (mirrors the list view) ──────────────────────────
  useEffect(() => {
    if (!ndk) return;

    const load = async () => {
      setLoading(true);
      const now = Math.floor(Date.now() / 1000);
      try {
        const results = await ndk.fetchEvents({
          kinds: [31922 as any, 31923 as any],
          since: now - 30 * 24 * 3600,
          limit: 1000,
        });

        const events = Array.from(results.values()) as NDKEvent[];
        const todayStart = dayjs().startOf("day");

        const upcoming = events
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
      } catch (e) {
        console.error("Failed to load events", e);
      } finally {
        setLoading(false);
      }
    };

    load();
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

  // ── Resolve coordinates for the selected day's events ───────────────────────
  useEffect(() => {
    let cancelled = false;

    const syncUpdates: Record<string, ResolvedCoord | null> = {};
    // location string (normalised) -> the events sharing it (geocode in one go)
    const toGeocode = new Map<string, { query: string; ids: string[] }>();

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
        const key = normalizeLocationKey(meta.location);
        const entry = toGeocode.get(key);
        if (entry) entry.ids.push(e.id);
        else toGeocode.set(key, { query: meta.location, ids: [e.id] });
      } else {
        syncUpdates[e.id] = null;
      }
    }

    if (Object.keys(syncUpdates).length > 0) {
      setCoordsById((prev) => ({ ...prev, ...syncUpdates }));
    }

    // Geocode unique location strings serially (the helper is rate-limited and
    // IndexedDB-cached, so repeat visits resolve instantly).
    (async () => {
      for (const { query, ids } of toGeocode.values()) {
        const coords = await geocodeLocation(query);
        if (cancelled) return;
        const resolved: ResolvedCoord | null = coords
          ? { lat: coords.lat, lon: coords.lon, source: "geocode" }
          : null;
        setCoordsById((prev) => {
          const next = { ...prev };
          for (const id of ids) next[id] = resolved;
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dayEvents]);

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
