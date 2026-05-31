"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { type NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { decodeGeohash } from "@/utils/location/geohash";
import {
  geocodeLocation,
  normalizeLocationKey,
} from "@/utils/location/geocodeCache";

/** A coordinate resolved for an event. */
export interface ResolvedCoord {
  lat: number;
  lon: number;
  /** "geohash" = decoded instantly from the `g` tag; "geocode" = Nominatim. */
  source: "geohash" | "geocode";
}

/**
 * Resolves each event to a coordinate so it can be placed on a map or filtered
 * by distance. Shared by the map view and the events list:
 *   1. the `g` geohash tag is decoded synchronously (instant), and
 *   2. events with only a `location` string are geocoded via the cached,
 *      rate-limited Nominatim helper, so coords fill in progressively.
 *
 * Each event is attempted exactly once (`attemptedRef`), and location-string
 * lookups run through a single persistent serial worker (`geocodeQueueRef`),
 * so an incrementally-growing `events` array only ever appends new work — it
 * never restarts an in-flight lookup.
 *
 * `coordsById[id]` is `null` when an event can't be placed; an id missing from
 * the map is still pending.
 */
export function useEventCoordinates(events: NDKEvent[]): {
  coordsById: Record<string, ResolvedCoord | null>;
  resolving: boolean;
} {
  // eventId -> resolved coord, or null when the event can't be placed.
  const [coordsById, setCoordsById] = useState<
    Record<string, ResolvedCoord | null>
  >({});
  // Events we've already started resolving — avoids re-attempting on every pass.
  const attemptedRef = useRef<Set<string>>(new Set());
  // Serial geocode queue for location-string events, drained by a persistent
  // worker so new work is appended rather than restarting an in-flight lookup.
  const geocodeQueueRef = useRef<
    { key: string; query: string; ids: string[] }[]
  >([]);
  const geocodeRunningRef = useRef(false);

  // Drains the geocode queue one entry at a time (Nominatim is rate-limited and
  // IndexedDB-cached, so repeat lookups resolve instantly).
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

  useEffect(() => {
    const syncUpdates: Record<string, ResolvedCoord | null> = {};

    for (const e of events) {
      if (attemptedRef.current.has(e.id)) continue;
      attemptedRef.current.add(e.id);

      const meta = getEventMetadata(e);

      if (meta.geohash) {
        try {
          const { latitude, longitude } = decodeGeohash(meta.geohash);
          syncUpdates[e.id] = {
            lat: latitude,
            lon: longitude,
            source: "geohash",
          };
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
  }, [events, drainGeocodeQueue]);

  // True while some of the events are still awaiting a coordinate.
  const resolving = useMemo(
    () => events.some((e) => !(e.id in coordsById)),
    [events, coordsById]
  );

  return { coordsById, resolving };
}
