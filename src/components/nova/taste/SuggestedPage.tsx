"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useNdk } from "nostr-hooks";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import dayjs from "dayjs";
import { Sparkles, MapPin } from "lucide-react";
import { useFilters } from "@/providers/FiltersContext";
import { useEventCoordinates } from "@/components/nova/map/useEventCoordinates";
import { calculateDistance } from "@/utils/location/locationUtils";
import {
  useTasteRows,
  eventCoordinate,
  isRemovedFromView,
} from "@/lib/taste/feedback";
import { useEventScores, scoreOf } from "@/lib/taste/scores";
import { suggestedScore } from "@/lib/taste/scoring";
import { useSuggestedKnobs } from "@/lib/taste/tunables";
import {
  useEventsStore,
  ensureFreshEvents,
  getEventStart,
} from "../events/eventsStore";
import { NovaEventCard } from "../events/NovaEventCard";

const NO_EVENTS: NDKEvent[] = [];

/**
 * /suggested — every upcoming event ranked by suggested_score (like-dislike.md,
 * "Combined score for /suggested"): taste · proximity · soonness, multiplied
 * with the tunable exponents from /debug/suggested. No day switcher — soonness
 * already orders time; the location filter's place (if set) is the proximity
 * origin, but its radius does not cut events off here.
 */
export function SuggestedPage() {
  const { ndk } = useNdk();
  const { location } = useFilters();
  const { events: storeEvents, loading } = useEventsStore();
  const tasteRows = useTasteRows();
  const knobs = useSuggestedKnobs();

  useEffect(() => {
    if (ndk) ensureFreshEvents(ndk);
  }, [ndk]);

  // Hidden/reported events never get suggested.
  const visible = useMemo(
    () =>
      storeEvents.filter((e) => {
        const coordinate = eventCoordinate(e);
        return !isRemovedFromView(coordinate ? tasteRows.get(coordinate) : undefined);
      }),
    [storeEvents, tasteRows]
  );

  const scores = useEventScores(visible);
  // Coordinates are only worth resolving when there is an origin to measure
  // from; without one, proximity is 1 for every event and drops out.
  const { coordsById, resolving } = useEventCoordinates(
    location ? visible : NO_EVENTS
  );

  const ranked = useMemo(() => {
    const now = dayjs();
    const origin = location
      ? { latitude: location.lat, longitude: location.lon }
      : null;
    return visible
      .map((event) => {
        const start = getEventStart(event);
        const daysUntilStart = start ? start.diff(now, "day", true) : 0;
        let distanceKm: number | null = null;
        if (origin) {
          const c = coordsById[event.id];
          if (c) {
            distanceKm = calculateDistance(origin, {
              latitude: c.lat,
              longitude: c.lon,
            });
          }
        }
        const taste = scoreOf(scores, eventCoordinate(event));
        return {
          event,
          score: suggestedScore(taste, distanceKm, daysUntilStart, knobs),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [visible, scores, coordsById, location, knobs]);

  return (
    <div className="px-[var(--margin-mobile)] md:px-[var(--margin-desktop)] py-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-on-surface">
        Suggested
      </h1>
      <p className="mb-4 flex items-center gap-1.5 text-xs text-on-surface-variant">
        {location ? (
          <>
            <MapPin size={13} className="text-primary flex-shrink-0" />
            <span className="truncate">
              Ranked by your taste, distance from {location.label}, and date
            </span>
          </>
        ) : (
          <span>
            Ranked by your taste and date —{" "}
            <Link href="/set-location-filter" className="underline">
              set a location
            </Link>{" "}
            to factor in distance
          </span>
        )}
      </p>

      {loading ? (
        <SuggestedSkeleton />
      ) : ranked.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Sparkles size={36} className="text-on-surface-variant opacity-30" />
          <p className="type-body-md text-on-surface-variant">
            Nothing to suggest yet — open the list to fetch events.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map(({ event }) => (
              <NovaEventCard key={event.id} event={event} />
            ))}
          </div>
          {location && resolving && (
            <p className="mt-4 text-xs text-on-surface-variant/70">
              Still locating some events — the order refines as they resolve.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SuggestedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--radius-xl)] bg-surface-low animate-pulse"
        >
          <div className="aspect-video bg-surface-high" />
          <div className="flex flex-col gap-2 p-4">
            <div className="h-4 w-3/4 rounded bg-surface-high" />
            <div className="h-3 w-1/2 rounded bg-surface-high" />
          </div>
        </div>
      ))}
    </div>
  );
}
