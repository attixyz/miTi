"use client";

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Heart,
  ThumbsDown,
  EyeOff,
  Flag,
  CalendarCheck,
  CalendarPlus,
  type LucideIcon,
} from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { cn } from "@/lib/utils";
import { useTasteRows } from "@/lib/taste/feedback";
import type { EventTasteRow } from "@/lib/taste/db";
import { NovaEventCard } from "../events/NovaEventCard";
import { useEventsByCoordinate } from "./useEventsByCoordinate";

type FeedbackTab =
  | "favorites"
  | "disliked"
  | "hidden"
  | "reported"
  | "rsvp"
  | "calendar";

interface TabConfig {
  value: FeedbackTab;
  label: string;
  icon: LucideIcon;
  /** Does this taste row belong to the tab? */
  match: (row: EventTasteRow) => boolean;
  /** Sort key — newest action first. */
  sortKey: (row: EventTasteRow) => number;
  /** Shown when the tab has no events. */
  emptyText: string;
}

/**
 * The segments of /your-feedback, one per stored feedback signal. RSVP and
 * add-to-calendar are included because the engine tracks them too
 * (`last_rsvp_state`, `added_to_calendar` in EventTasteRow). RSVP has no
 * dedicated timestamp, so it orders by the row's last change (`updated_at`).
 */
const TABS: TabConfig[] = [
  {
    value: "favorites",
    label: "Favorites",
    icon: Heart,
    match: (r) => r.clicked_like != null,
    sortKey: (r) => r.clicked_like ?? 0,
    emptyText: "No favorites yet — tap the heart on an event you like.",
  },
  {
    value: "disliked",
    label: "Disliked",
    icon: ThumbsDown,
    match: (r) => r.clicked_dislike != null,
    sortKey: (r) => r.clicked_dislike ?? 0,
    emptyText: "No disliked events yet — tap the dislike on an event you’re not into.",
  },
  {
    value: "hidden",
    label: "Hidden",
    icon: EyeOff,
    match: (r) => r.clicked_hide != null,
    sortKey: (r) => r.clicked_hide ?? 0,
    emptyText: "Nothing hidden yet — tap hide to remove an event from your lists.",
  },
  {
    value: "reported",
    label: "Reported",
    icon: Flag,
    match: (r) => r.clicked_report != null,
    sortKey: (r) => r.clicked_report ?? 0,
    emptyText: "Nothing reported.",
  },
  {
    value: "rsvp",
    label: "RSVP’d",
    icon: CalendarCheck,
    match: (r) => r.last_rsvp_state != null,
    sortKey: (r) => r.updated_at ?? 0,
    emptyText: "No RSVPs yet — respond to an event you’re planning to attend.",
  },
  {
    value: "calendar",
    label: "Added to calendar",
    icon: CalendarPlus,
    match: (r) => r.added_to_calendar != null,
    sortKey: (r) => r.added_to_calendar ?? 0,
    emptyText: "Nothing added to a calendar yet.",
  },
];

/**
 * /your-feedback — one place for every event the user has acted on. A
 * segmented control switches between the feedback signals (favorites, disliked,
 * hidden, reported, RSVP'd, added-to-calendar); the panel below shows the
 * matching events as cards. Replaces the old standalone /favorites and
 * /disliked routes (like-dislike.md, "UI and routes").
 */
export function NovaYourFeedbackPage() {
  const [tab, setTab] = useState<FeedbackTab>("favorites");
  const tasteRows = useTasteRows();

  // One pass over the rows gives every tab's badge count.
  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.value, 0])) as Record<
      FeedbackTab,
      number
    >;
    for (const row of tasteRows.values()) {
      for (const t of TABS) if (t.match(row)) c[t.value] += 1;
    }
    return c;
  }, [tasteRows]);

  const config = TABS.find((t) => t.value === tab)!;

  const rows = useMemo(
    () =>
      [...tasteRows.values()]
        .filter(config.match)
        .sort((a, b) => config.sortKey(b) - config.sortKey(a)),
    [tasteRows, config]
  );
  const coordinates = useMemo(() => rows.map((r) => r.coordinate), [rows]);
  const eventsByCoordinate = useEventsByCoordinate(coordinates);
  const events = useMemo(
    () =>
      rows
        .map((r) => eventsByCoordinate.get(r.coordinate))
        .filter((e): e is NDKEvent => e != null),
    [rows, eventsByCoordinate]
  );

  const EmptyIcon = config.icon;
  const missing = rows.length - events.length;

  return (
    <div className="px-[var(--margin-mobile)] md:px-[var(--margin-desktop)] py-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-on-surface">
        Your feedback
      </h1>
      <p className="mb-4 text-xs text-on-surface-variant">
        Every event you’ve reacted to, in one place.
      </p>

      <FeedbackTabs active={tab} counts={counts} onChange={setTab} />

      <div
        role="tabpanel"
        id={`feedback-panel-${tab}`}
        aria-labelledby={`feedback-tab-${tab}`}
        className="mt-5"
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <EmptyIcon size={36} className="text-on-surface-variant opacity-30" />
            <p className="type-body-md text-on-surface-variant">
              {config.emptyText}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <NovaEventCard key={event.id} event={event} showDate />
              ))}
            </div>
            {missing > 0 && (
              <p className="mt-4 text-xs text-on-surface-variant/70">
                {missing} event{missing !== 1 ? "s" : ""} couldn’t be loaded from
                the cache or relays.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Icon + label segmented control. Single-select tabs (roving tabindex +
 * arrow-key nav) since each segment swaps the panel below; scrolls horizontally
 * on narrow screens. Each segment carries a count badge.
 */
function FeedbackTabs({
  active,
  counts,
  onChange,
}: {
  active: FeedbackTab;
  counts: Record<FeedbackTab, number>;
  onChange: (tab: FeedbackTab) => void;
}) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.value === active);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    const value = TABS[next].value;
    onChange(value);
    tabRefs.current[value]?.focus();
  }

  return (
    <div className="-mx-[var(--margin-mobile)] overflow-x-auto px-[var(--margin-mobile)] md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        role="tablist"
        aria-label="Feedback type"
        onKeyDown={onKeyDown}
        className="inline-flex w-max overflow-hidden rounded-full border border-outline-variant/40"
      >
        {TABS.map(({ value, label, icon: Icon }) => {
          const selected = value === active;
          const count = counts[value];
          return (
            <button
              key={value}
              ref={(el) => {
                tabRefs.current[value] = el;
              }}
              type="button"
              role="tab"
              id={`feedback-tab-${value}`}
              aria-selected={selected}
              aria-controls={`feedback-panel-${value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(value)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold transition-colors",
                selected
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-high"
              )}
            >
              <Icon size={14} className="shrink-0" />
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                    selected
                      ? "bg-on-primary/20 text-on-primary"
                      : "bg-surface-high text-on-surface-variant"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
