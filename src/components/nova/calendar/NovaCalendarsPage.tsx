"use client";

import { Search, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNovaCalendars } from "./useNovaCalendars";
import { NovaCalendarCard } from "./NovaCalendarCard";

export function NovaCalendarsPage() {
  const {
    loading,
    calendars,
    totalCount,
    search,
    setSearch,
    hideEmpty,
    setHideEmpty,
    hideTest,
    setHideTest,
  } = useNovaCalendars();

  return (
    <div className="flex flex-col gap-5 py-4 px-[var(--margin-mobile)] md:px-[var(--margin-desktop)]">
      <div className="flex flex-col gap-1">
        <h1 className="type-headline-lg-mobile md:type-headline-lg text-on-surface">
          Calendars
        </h1>
        <p className="type-body-sm text-on-surface-variant">
          Browse and subscribe to event calendars.
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-3 rounded-[var(--radius-md)] bg-surface-low border border-outline-variant/40 focus-within:border-primary transition-colors">
          <Search size={18} className="text-on-surface-variant flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search calendars…"
            className="flex-1 bg-transparent outline-none type-body-md text-on-surface placeholder:text-on-surface-variant/60 py-2.5"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Has events"
            active={hideEmpty}
            onClick={() => setHideEmpty((v) => !v)}
          />
          <FilterChip
            label="Hide test"
            active={hideTest}
            onClick={() => setHideTest((v) => !v)}
          />
        </div>
      </div>

      {loading ? (
        <CalendarsSkeleton />
      ) : calendars.length === 0 ? (
        <EmptyState totalCount={totalCount} />
      ) : (
        <>
          <span className="type-body-sm text-on-surface-variant">
            {search
              ? `${calendars.length} match${calendars.length !== 1 ? "es" : ""}`
              : `Showing ${calendars.length} calendar${calendars.length !== 1 ? "s" : ""}`}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {calendars.map((calendar) => (
              <NovaCalendarCard key={calendar.id} calendar={calendar} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full type-label-sm font-medium transition-colors border",
        active
          ? "bg-primary text-on-primary border-primary"
          : "bg-surface-low text-on-surface-variant border-outline-variant/40 hover:text-on-surface"
      )}
    >
      {label}
    </button>
  );
}

function CalendarsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
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

function EmptyState({ totalCount }: { totalCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <CalendarRange size={40} className="text-on-surface-variant opacity-30" />
      <p className="type-body-md text-on-surface-variant">No calendars found</p>
      {totalCount > 0 && (
        <p className="text-xs text-on-surface-variant opacity-60">
          {totalCount} loaded — try adjusting the filters
        </p>
      )}
    </div>
  );
}
