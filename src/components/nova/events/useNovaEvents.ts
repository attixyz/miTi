"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNdk } from "nostr-hooks";
import { type NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { useFilters } from "@/providers/FiltersContext";
import { useEventCoordinates } from "@/components/nova/map/useEventCoordinates";
import { calculateDistance } from "@/utils/location/locationUtils";
import { eventCoordinate } from "@/lib/taste/feedback";
import { scoreOf } from "@/lib/taste/scores";
import { useVisibleEvents } from "@/lib/taste/visibility";
import dayjs from "dayjs";
import {
  useEventsStore,
  ensureFreshEvents,
  refreshEvents,
  getEventStart,
} from "./eventsStore";

// Canonical implementation moved to eventsStore; re-exported because cards,
// the map and the calendar feature all import it from here.
export { getEventStart } from "./eventsStore";

// Stable empty array so passing "nothing to resolve" doesn't churn the
// coordinate hook's effect on every render.
const NO_EVENTS: NDKEvent[] = [];

/**
 * /list ordering: taste (like_score descending, default) or distance (closest
 * first). Distance needs a center point, so it's only selectable when the
 * location filter holds a place (city or "Near me"), not "Anywhere".
 */
export type ListSort = "taste" | "distance";

export interface NovaEventsOptions {
  /**
   * /tag/[name]: pin one tag — only events carrying it flow through the day,
   * location and sort pipeline. The tag filter chips are meaningless then
   * (every event already matches) and the page hides them.
   */
  fixedTag?: string;
}

export function useNovaEvents({ fixedTag }: NovaEventsOptions = {}) {
  const { ndk } = useNdk();
  // `selectedDay` lives in FiltersContext so it persists when switching between
  // /list and /map (see FiltersContext).
  const { location, radiusKm, selectedDay, setSelectedDay } = useFilters();
  // Fetching, dedup and sorting live in the app-wide events store (one shared
  // NDK subscription, 1h staleness, manual refresh); this hook only filters
  // the shared snapshot by day, tags and location.
  const { events: storeEvents, loading, fetching } = useEventsStore();
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<ListSort>("taste");

  // Distance sort measures from the location filter's center, so it's only
  // available once a concrete place is set ("Anywhere" → location null → no
  // origin to measure from). If the user clears the place while distance is
  // selected, fall back to taste.
  const canSortByDistance = location != null;
  useEffect(() => {
    if (sortBy === "distance" && !canSortByDistance) setSortBy("taste");
  }, [sortBy, canSortByDistance]);

  // Shared feed visibility gate (see visibility.ts): user-hidden/reported events
  // plus the algorithmic spam signals (low_like_score, short_text) drop out here.
  // The returned score map is reused below for the taste sort.
  const { visible: allEvents, scores } = useVisibleEvents(storeEvents);

  useEffect(() => {
    if (ndk) ensureFreshEvents(ndk);
  }, [ndk]);

  const refresh = useCallback(() => {
    if (ndk) refreshEvents(ndk);
  }, [ndk]);

  const tagEvents = useMemo(() => {
    const tag = fixedTag?.toLowerCase();
    if (!tag) return allEvents;
    return allEvents.filter((e) =>
      getEventMetadata(e).hashtags.some((t: string) => t.toLowerCase() === tag)
    );
  }, [allEvents, fixedTag]);

  const dayEvents = useMemo(() => {
    const selected = dayjs(selectedDay);
    return tagEvents.filter((e) => {
      const start = getEventStart(e);
      return start && start.isSame(selected, "day");
    });
  }, [tagEvents, selectedDay]);

  // App-wide location filter: when a location is set with a concrete radius
  // ("Any distance" = null skips this), keep only the day's events within that
  // radius. Coordinates resolve via the shared hook (geohash decode + cached
  // Nominatim); events whose coordinate hasn't resolved yet — or can't be —
  // are excluded while the filter is active, so the list fills in progressively.
  // We resolve coordinates whenever a place is set (`canSortByDistance`): the
  // radius filter, the distance sort, and the per-card distance badge all need
  // each event's coordinate. With "Anywhere" set we leave the list alone so it
  // never triggers Nominatim traffic it doesn't need.
  const locationActive = location != null && radiusKm != null;
  const { coordsById, resolving } = useEventCoordinates(
    canSortByDistance ? dayEvents : NO_EVENTS
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

  // Distance (km) from the active filter location for each placeable event,
  // shown on the cards and reused by the distance sort. Only computed when a
  // place is set ("Anywhere" → no origin to measure from); events without a
  // resolved coordinate are simply absent from the map.
  const distanceById = useMemo(() => {
    const map: Record<string, number> = {};
    if (!location) return map;
    const origin = { latitude: location.lat, longitude: location.lon };
    for (const e of geoEvents) {
      const c = coordsById[e.id];
      if (c) {
        map[e.id] = calculateDistance(origin, {
          latitude: c.lat,
          longitude: c.lon,
        });
      }
    }
    return map;
  }, [location, geoEvents, coordsById]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    geoEvents.forEach((e) => {
      getEventMetadata(e).hashtags.forEach((tag: string) =>
        tags.add(tag.toLowerCase())
      );
    });
    return Array.from(tags).sort();
  }, [geoEvents]);

  // Sort the (tag-filtered) day's events. Both sorts fall back to the underlying
  // start-time order on ties (Array.sort is stable):
  //   • taste (like-dislike.md, "UI and routes"): like_score descending, reusing
  //     the score map from the visibility gate above.
  //   • distance: nearest the filter location first; events whose coordinate
  //     hasn't resolved (or can't be placed) sink to the bottom.
  const filteredEvents = useMemo(() => {
    const tagged =
      activeTags.length === 0
        ? geoEvents
        : geoEvents.filter((e) => {
            const eventTags = getEventMetadata(e).hashtags.map((t: string) =>
              t.toLowerCase()
            );
            return activeTags.some((tag) => eventTags.includes(tag));
          });
    if (sortBy === "distance" && location) {
      return [...tagged].sort(
        (a, b) =>
          (distanceById[a.id] ?? Infinity) - (distanceById[b.id] ?? Infinity)
      );
    }
    return [...tagged].sort(
      (a, b) =>
        scoreOf(scores, eventCoordinate(b)) - scoreOf(scores, eventCoordinate(a))
    );
  }, [geoEvents, activeTags, sortBy, scores, location, distanceById]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return {
    loading,
    fetching,
    refresh,
    filteredEvents,
    distanceById,
    availableTags,
    activeTags,
    toggleTag,
    selectedDay,
    setSelectedDay,
    sortBy,
    setSortBy,
    canSortByDistance,
    totalCount: tagEvents.length,
    // Location filter status (consumed by the page for a header line).
    locationActive,
    locationLabel: location?.label ?? null,
    radiusKm,
    // Still geocoding some of the day's events while a location filter is on.
    locationResolving: locationActive && resolving,
  };
}
