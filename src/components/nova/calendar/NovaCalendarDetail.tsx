"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarX, CalendarRange, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { encodeEventToNaddr } from "@/utils/nostr/nostrUtils";
import { useActiveUser } from "@/hooks/useActiveUser";
import { getEventStart } from "@/components/nova/events/useNovaEvents";
import { NovaEventCard } from "@/components/nova/events/NovaEventCard";
import { NovaEventHost } from "@/components/nova/event/NovaEventHost";
import { useNovaCalendar } from "./useNovaCalendar";
import { useCalendarMutations } from "./useCalendarMutations";
import { NovaCalendarActions } from "./NovaCalendarActions";
import { NovaCalendarIcs } from "./NovaCalendarIcs";

type Filter = "approved" | "all";

function coordinateOf(event: NDKEvent): string | null {
  const d = event.tags.find((t) => t[0] === "d")?.[1];
  return d ? `${event.kind}:${event.pubkey}:${d}` : null;
}

export function NovaCalendarDetail({ calendarId }: { calendarId: string }) {
  const router = useRouter();
  const {
    calendar,
    loading,
    notFound,
    upcoming,
    past,
    unapproved,
    eventsLoading,
    reload,
  } = useNovaCalendar(calendarId);
  const activeUser = useActiveUser();
  const { approveEvent, publishing } = useCalendarMutations();
  const [filter, setFilter] = useState<Filter>("approved");

  const metadata = useMemo(
    () => (calendar ? getEventMetadata(calendar) : null),
    [calendar]
  );
  const isOwner = Boolean(
    activeUser && calendar && activeUser.pubkey === calendar.pubkey
  );
  const naddr = useMemo(
    () => (calendar ? encodeEventToNaddr(calendar) : ""),
    [calendar]
  );

  const showUnapprovedInline = filter === "all" && !isOwner;
  const { mergedUpcoming, mergedPast } = useMemo(() => {
    if (!showUnapprovedInline || unapproved.length === 0) {
      return { mergedUpcoming: upcoming, mergedPast: past };
    }
    const now = Date.now() / 1000;
    const isUpcoming = (e: NDKEvent) => {
      const start = getEventStart(e);
      return start ? start.unix() > now : false;
    };
    return {
      mergedUpcoming: [...upcoming, ...unapproved.filter(isUpcoming)],
      mergedPast: [...past, ...unapproved.filter((e) => !isUpcoming(e))],
    };
  }, [showUnapprovedInline, upcoming, past, unapproved]);

  async function approve(event: NDKEvent) {
    if (!calendar) return;
    const coord = coordinateOf(event);
    if (!coord) return;
    try {
      await approveEvent(calendar, coord);
      reload();
    } catch (e) {
      console.error("Failed to approve event", e);
    }
  }

  if (notFound) {
    return (
      <div className="max-w-[1100px] mx-auto px-[var(--margin-mobile)] md:px-[var(--margin-desktop)] py-16">
        <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
          <CalendarX size={48} className="text-on-surface-variant opacity-40" />
          <p className="type-headline-md text-on-surface">Calendar not found</p>
          <p className="type-body-sm text-on-surface-variant">
            This calendar couldn’t be loaded from the relay or cache.
          </p>
          <button
            onClick={() => router.push("/calendars")}
            className="mt-2 px-4 py-2 rounded-full bg-primary text-on-primary type-body-sm font-medium"
          >
            Browse calendars
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-[var(--margin-mobile)] md:px-[var(--margin-desktop)] py-3 md:py-6 flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors type-body-sm"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        {calendar && (
          <div className="flex items-center gap-2">
            <NovaCalendarIcs calendar={calendar} />
            {isOwner && <NovaCalendarActions calendar={calendar} />}
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="flex flex-col gap-4">
        <div className="relative w-full aspect-[3/1] min-h-[160px] rounded-[var(--radius-xl)] overflow-hidden bg-surface-high">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-container/40 to-primary/20 flex items-center justify-center">
            <CalendarRange size={48} className="text-primary/30" />
          </div>
          {metadata?.image && (
            <img
              src={metadata.image}
              alt={metadata.title || "Calendar"}
              className="relative w-full h-full object-cover"
            />
          )}
        </div>

        {loading || !metadata ? (
          <HeroSkeleton />
        ) : (
          <div className="flex flex-col gap-3">
            <h1 className="type-headline-lg-mobile md:type-headline-lg text-on-surface">
              {metadata.title || "Untitled Calendar"}
            </h1>
            <NovaEventHost pubkey={calendar?.pubkey} />
            {metadata.summary && (
              <p className="type-body-md text-on-surface-variant whitespace-pre-line break-words">
                {metadata.summary}
              </p>
            )}
            {activeUser && (
              <Link
                href={`/new-event?calendar=${naddr}`}
                className="inline-flex items-center gap-1.5 w-fit px-4 py-2 rounded-full bg-primary text-on-primary type-body-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={16} /> Add event
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pending approval (owner) */}
      {isOwner && unapproved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="type-headline-md text-on-surface">
            Pending approval
            <span className="ml-2 type-body-sm text-on-surface-variant">
              {unapproved.length}
            </span>
          </h2>
          <div className="h-px w-full bg-outline-variant/30" />
          <div className="flex flex-col gap-2">
            {unapproved.map((event) => (
              <PendingRow
                key={event.id}
                event={event}
                disabled={publishing}
                onApprove={() => approve(event)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Viewer toggle */}
      {!isOwner && unapproved.length > 0 && (
        <div className="flex items-center gap-2">
          <ToggleButton
            label="Only approved"
            active={filter === "approved"}
            onClick={() => setFilter("approved")}
          />
          <ToggleButton
            label={`All meetups (+${unapproved.length})`}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </div>
      )}

      <EventSection
        title="Upcoming events"
        events={mergedUpcoming}
        loading={eventsLoading}
        emptyText="No upcoming events"
      />
      <EventSection
        title="Past events"
        events={mergedPast}
        loading={eventsLoading}
        emptyText="No past events"
      />
    </div>
  );
}

function PendingRow({
  event,
  disabled,
  onApprove,
}: {
  event: NDKEvent;
  disabled: boolean;
  onApprove: () => void;
}) {
  const meta = getEventMetadata(event);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-surface-low border border-outline-variant/30">
      <div className="flex flex-col min-w-0">
        <span className="type-body-md text-on-surface truncate">
          {meta.title || "Untitled Event"}
        </span>
        {meta.location && (
          <span className="type-body-sm text-on-surface-variant truncate">
            {meta.location}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onApprove}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-on-primary type-label-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
      >
        <Check size={14} /> Approve
      </button>
    </div>
  );
}

function ToggleButton({
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

function EventSection({
  title,
  events,
  loading,
  emptyText,
}: {
  title: string;
  events: NDKEvent[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-headline-md text-on-surface">{title}</h2>
      <div className="h-px w-full bg-outline-variant/30" />
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
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
      ) : events.length === 0 ? (
        <p className="type-body-md text-on-surface-variant opacity-60">
          {emptyText}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <NovaEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-8 w-3/4 rounded bg-surface-high" />
      <div className="h-4 w-1/3 rounded bg-surface-high" />
      <div className="h-4 w-full rounded bg-surface-high" />
    </div>
  );
}
