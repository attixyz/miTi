"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNdk } from "nostr-hooks";
import { type NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { useFilters } from "@/providers/FiltersContext";
import { useEventCoordinates } from "@/components/nova/map/useEventCoordinates";
import { calculateDistance } from "@/utils/location/locationUtils";
import {
  useTasteRows,
  eventCoordinate,
  isRemovedFromView,
} from "@/lib/taste/feedback";
import { useEventScores, scoreOf } from "@/lib/taste/scores";
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

/** /list ordering: start time (default) or taste (like_score descending). */
export type ListSort = "time" | "taste";

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
  const [sortBy, setSortBy] = useState<ListSort>("time");

  // Events the user hid or reported are removed from view (like-dislike.md:
  // hide carries no points, report is moderation — both just disappear here).
  const tasteRows = useTasteRows();
  const allEvents = useMemo(
    () =>
      storeEvents.filter((e) => {
        const coordinate = eventCoordinate(e);
        return !isRemovedFromView(coordinate ? tasteRows.get(coordinate) : undefined);
      }),
    [storeEvents, tasteRows]
  );

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

  // Taste sort (like-dislike.md, "UI and routes"): lazily computed like_score,
  // descending. Scores are only resolved while the sort is active; ties keep
  // the time order (Array.sort is stable).
  const scores = useEventScores(sortBy === "taste" ? geoEvents : NO_EVENTS);

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
    if (sortBy !== "taste") return tagged;
    return [...tagged].sort(
      (a, b) =>
        scoreOf(scores, eventCoordinate(b)) - scoreOf(scores, eventCoordinate(a))
    );
  }, [geoEvents, activeTags, sortBy, scores]);

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
    availableTags,
    activeTags,
    toggleTag,
    selectedDay,
    setSelectedDay,
    sortBy,
    setSortBy,
    totalCount: tagEvents.length,
    // Location filter status (consumed by the page for a header line).
    locationActive,
    locationLabel: location?.label ?? null,
    radiusKm,
    // Still geocoding some of the day's events while a location filter is on.
    locationResolving: locationActive && resolving,
  };
}
