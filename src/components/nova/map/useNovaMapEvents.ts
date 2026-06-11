"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useNdk } from "nostr-hooks";
import { type NDKEvent } from "@nostr-dev-kit/ndk";
import dayjs from "dayjs";
import {
  useEventsStore,
  ensureFreshEvents,
  refreshEvents,
  getEventStart,
} from "@/components/nova/events/eventsStore";
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
 * Data layer for the map view. Reads upcoming events from the app-wide events
 * store (one shared NDK subscription with /list — see eventsStore), filters to
 * the selected day, then resolves each to a coordinate via the shared
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
  const { events: allEvents, loading, fetching } = useEventsStore();

  useEffect(() => {
    if (ndk) ensureFreshEvents(ndk);
  }, [ndk]);

  const refresh = useCallback(() => {
    if (ndk) refreshEvents(ndk);
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
    fetching,
    refresh,
    resolving,
    selectedDay,
    setSelectedDay,
    dayEventCount: dayEvents.length,
    mappedCount: mapEvents.length,
    mapEvents,
  };
}
