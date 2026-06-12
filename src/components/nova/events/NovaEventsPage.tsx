"use client";

import dayjs from "dayjs";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNovaEvents } from "./useNovaEvents";
import type { ListSort } from "./useNovaEvents";
import { DaySwitcher } from "./DaySwitcher";
import { TagFilterChips } from "./TagFilterChips";
import { NovaEventCard } from "./NovaEventCard";

/**
 * The /list page — and, with `fixedTag`, the /tag/[name] page: same day and
 * location filters, same taste sort, but pinned to one tag and without the
 * tag chips (like-dislike.md, "UI and routes").
 */
export function NovaEventsPage({ fixedTag }: { fixedTag?: string }) {
  const {
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
    totalCount,
    locationActive,
    locationLabel,
    radiusKm,
    locationResolving,
  } = useNovaEvents({ fixedTag });

  const selectedDayjs = dayjs(selectedDay);
  const isToday = selectedDayjs.isSame(dayjs(), "day");
  const dateLabel = isToday
    ? "Today"
    : selectedDayjs.format("dddd, MMMM D");

  return (
    <div className="flex flex-col gap-4 pb-4">
      {fixedTag && (
        <h1 className="px-[var(--margin-mobile)] md:px-[var(--margin-desktop)] pt-4 text-2xl font-bold tracking-tight text-on-surface">
          #{fixedTag}
        </h1>
      )}
      <div
        className={cn(
          "sticky top-16 z-30",
          "bg-surface",
          "border-b border-outline-variant/30"
        )}
      >
        <div className="flex flex-col gap-3 py-3">
          <DaySwitcher
            selectedDay={selectedDay}
            onSelect={setSelectedDay}
          />
          {!fixedTag && (
            <TagFilterChips
              tags={availableTags}
              activeTags={activeTags}
              onToggle={toggleTag}
            />
          )}
        </div>
      </div>

      <div className="px-[var(--margin-mobile)] md:px-[var(--margin-desktop)]">
        <div className="mb-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="type-body-md font-semibold text-on-surface">
              {dateLabel}
            </h2>
            <div className="flex items-center gap-1.5">
              {!loading && (
                <span className="text-xs text-on-surface-variant">
                  {filteredEvents.length === 0
                    ? "No events"
                    : `${filteredEvents.length} event${filteredEvents.length !== 1 ? "s" : ""}`}
                </span>
              )}
              <SortToggle sortBy={sortBy} onChange={setSortBy} />
              <button
                type="button"
                aria-label="Refresh events"
                onClick={refresh}
                disabled={fetching}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  "text-on-surface-variant transition-colors",
                  "hover:bg-surface-high hover:text-on-surface",
                  "disabled:pointer-events-none disabled:opacity-60"
                )}
              >
                <RefreshCw size={14} className={cn(fetching && "animate-spin")} />
              </button>
            </div>
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

/** Order the day's events by start time or by learned taste (like_score). */
function SortToggle({
  sortBy,
  onChange,
}: {
  sortBy: ListSort;
  onChange: (sort: ListSort) => void;
}) {
  const options: { value: ListSort; label: string }[] = [
    { value: "time", label: "Time" },
    { value: "taste", label: "Taste" },
  ];
  return (
    <div
      role="group"
      aria-label="Sort events"
      className="flex overflow-hidden rounded-full border border-outline-variant/40"
    >
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={sortBy === value}
          onClick={() => onChange(value)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-semibold transition-colors",
            sortBy === value
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:bg-surface-high"
          )}
        >
          {label}
        </button>
      ))}
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
