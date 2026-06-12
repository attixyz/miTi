"use client";

import { useMemo } from "react";
import { Heart } from "lucide-react";
import { useTasteRows } from "@/lib/taste/feedback";
import { NovaEventCard } from "../events/NovaEventCard";
import { useEventsByCoordinate } from "./useEventsByCoordinate";

/**
 * /favorites — every event with clicked_like set, ordered by clicked_like
 * descending (like-dislike.md, "UI and routes").
 */
export function FavoritesPage() {
  const tasteRows = useTasteRows();

  const liked = useMemo(
    () =>
      [...tasteRows.values()]
        .filter((row) => row.clicked_like != null)
        .sort((a, b) => (b.clicked_like ?? 0) - (a.clicked_like ?? 0)),
    [tasteRows]
  );
  const coordinates = useMemo(() => liked.map((row) => row.coordinate), [liked]);
  const eventsByCoordinate = useEventsByCoordinate(coordinates);

  const events = useMemo(
    () =>
      liked
        .map((row) => eventsByCoordinate.get(row.coordinate))
        .filter((event) => event != null),
    [liked, eventsByCoordinate]
  );

  return (
    <div className="px-[var(--margin-mobile)] md:px-[var(--margin-desktop)] py-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-on-surface">
        Favorites
      </h1>

      {liked.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Heart size={36} className="text-on-surface-variant opacity-30" />
          <p className="type-body-md text-on-surface-variant">
            No favorites yet — tap the heart on an event you like.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <NovaEventCard key={event.id} event={event} />
            ))}
          </div>
          {events.length < liked.length && (
            <p className="mt-4 text-xs text-on-surface-variant/70">
              {liked.length - events.length} liked event
              {liked.length - events.length !== 1 ? "s" : ""} couldn’t be loaded
              from the cache or relays.
            </p>
          )}
        </>
      )}
    </div>
  );
}
