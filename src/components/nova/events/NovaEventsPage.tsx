"use client";

import dayjs from "dayjs";
import { Loader2, MapPin } from "lucide-react";
import { useNovaEvents } from "./useNovaEvents";
import { DaySwitcher } from "./DaySwitcher";
import { TagFilterChips } from "./TagFilterChips";
import { NovaEventCard } from "./NovaEventCard";

export function NovaEventsPage() {
  const {
    loading,
    filteredEvents,
    availableTags,
    activeTags,
    toggleTag,
    selectedDay,
    setSelectedDay,
    daysWithEvents,
    totalCount,
    locationActive,
    locationLabel,
    radiusKm,
    locationResolving,
  } = useNovaEvents();

  const selectedDayjs = dayjs(selectedDay);
  const isToday = selectedDayjs.isSame(dayjs(), "day");
  const dateLabel = isToday
    ? "Today"
    : selectedDayjs.format("dddd, MMMM D");

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-3">
        <DaySwitcher
          selectedDay={selectedDay}
          daysWithEvents={daysWithEvents}
          onSelect={setSelectedDay}
        />
        <TagFilterChips
          tags={availableTags}
          activeTags={activeTags}
          onToggle={toggleTag}
        />
      </div>

      <div className="px-[var(--margin-mobile)] md:px-[var(--margin-desktop)]">
        <div className="mb-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="type-body-md font-semibold text-on-surface">
              {dateLabel}
            </h2>
            {!loading && (
              <span className="text-xs text-on-surface-variant">
                {filteredEvents.length === 0
                  ? "No events"
                  : `${filteredEvents.length} event${filteredEvents.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>

          {locationActive && locationLabel && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <MapPin size={13} className="text-primary flex-shrink-0" />
              <span className="truncate">
                Within {radiusKm} km of {locationLabel}
              </span>
              {locationResolving && (
                <Loader2 size={12} className="animate-spin flex-shrink-0" />
              )}
            </div>
          )}
        </div>

        {loading ? (
          <EventsSkeleton />
        ) : filteredEvents.length === 0 ? (
          locationResolving ? (
            <LocatingState label={locationLabel} />
          ) : (
            <EmptyState totalCount={totalCount} locationActive={locationActive} />
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <NovaEventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-xl)] overflow-hidden bg-surface-low animate-pulse"
        >
          <div className="aspect-video bg-surface-high" />
          <div className="p-4 flex flex-col gap-2">
            <div className="h-4 bg-surface-high rounded w-3/4" />
            <div className="h-3 bg-surface-high rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  totalCount,
  locationActive,
}: {
  totalCount: number;
  locationActive: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <span className="text-4xl opacity-30">{locationActive ? "📍" : "📅"}</span>
      <p className="type-body-md text-on-surface-variant">
        {locationActive
          ? "No events near this location on this day"
          : "No events on this day"}
      </p>
      {locationActive ? (
        <p className="text-xs text-on-surface-variant opacity-60">
          Try a wider radius, a different location, or another day
        </p>
      ) : (
        totalCount > 0 && (
          <p className="text-xs text-on-surface-variant opacity-60">
            {totalCount} events loaded — try a different day
          </p>
        )
      )}
    </div>
  );
}

function LocatingState({ label }: { label: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Loader2 size={28} className="animate-spin text-primary opacity-70" />
      <p className="type-body-md text-on-surface-variant">
        Finding events{label ? ` near ${label}` : ""}…
      </p>
    </div>
  );
}
