"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, CalendarDays, MapPin, Link2, CalendarX } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { useNovaEvent } from "./useNovaEvent";
import { formatEventSchedule } from "./eventSchedule";
import { NovaEventHost } from "./NovaEventHost";
import { NovaEventActions } from "./NovaEventActions";
import { NovaEventMap } from "./NovaEventMap";
import { NovaEventRsvp } from "./NovaEventRsvp";
import { NovaAddToCalendar } from "./NovaAddToCalendar";

export function NovaEventDetail({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { event, loading, notFound } = useNovaEvent(eventId);
  const [imgLoaded, setImgLoaded] = useState(false);

  const metadata = useMemo(
    () => (event ? getEventMetadata(event) : null),
    [event]
  );

  const schedule = useMemo(
    () =>
      metadata
        ? formatEventSchedule({
            kind: event?.kind,
            start: metadata.start,
            end: metadata.end,
            start_tzid: metadata.start_tzid,
            end_tzid: metadata.end_tzid,
          })
        : null,
    [metadata, event?.kind]
  );

  function handleShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: metadata?.title || "Event", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).catch(() => {});
    }
  }

  if (notFound) {
    return (
      <div className="max-w-[1100px] mx-auto px-[var(--margin-mobile)] md:px-[var(--margin-desktop)] py-16">
        <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
          <CalendarX size={48} className="text-on-surface-variant opacity-40" />
          <p className="type-headline-md text-on-surface">Event not found</p>
          <p className="type-body-sm text-on-surface-variant">
            This event couldn’t be loaded from the relay or cache.
          </p>
          <button
            onClick={() => router.push("/events")}
            className="mt-2 px-4 py-2 rounded-full bg-primary text-on-primary type-body-sm font-medium"
          >
            Browse events
          </button>
        </div>
      </div>
    );
  }

  const mainText = metadata ? metadata.content || metadata.description || "" : "";
  const shortDescription = metadata?.shortDescription;
  const hashtags: string[] = metadata?.hashtags ?? [];
  const references: string[] = metadata?.references ?? [];

  return (
    <div className="max-w-[1100px] mx-auto px-[var(--margin-mobile)] md:px-[var(--margin-desktop)] py-3 md:py-6">
      {/* Back / share row */}
      <div className="flex items-center justify-between mb-3 md:mb-5">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors type-body-sm"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <button
          onClick={handleShare}
          aria-label="Share event"
          className="flex items-center justify-center w-9 h-9 rounded-full text-on-surface-variant hover:bg-surface-high transition-colors"
        >
          <Share2 size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="md:col-span-8 flex flex-col gap-6">
          {/* Hero */}
          <div className="relative w-full aspect-video rounded-[var(--radius-xl)] overflow-hidden bg-surface-high">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-container/40 to-primary/20 flex items-center justify-center">
              <span className="text-5xl opacity-20">📅</span>
            </div>
            {metadata?.image && (
              <img
                src={metadata.image}
                alt={metadata.title || "Event"}
                onLoad={() => setImgLoaded(true)}
                className={cn(
                  "relative w-full h-full object-cover transition-opacity duration-500",
                  imgLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            )}
            {/* Like + flag actions overlay (available as soon as the event is) */}
            {event && <NovaEventActions />}
          </div>

          {/* Info block */}
          <div className="flex flex-col gap-4">
            {loading || !metadata ? (
              <InfoSkeleton />
            ) : (
              <>
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {hashtags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full bg-surface-high text-on-surface-variant type-label-sm uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <h1 className="type-headline-lg-mobile md:type-headline-lg text-on-surface">
                  {metadata.title || "Untitled Event"}
                </h1>

                <NovaEventHost pubkey={event?.pubkey} />

                {shortDescription && (
                  <p className="type-body-lg text-on-surface-variant">
                    {shortDescription}
                  </p>
                )}

                {/* Date + location bento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                  <div className="rounded-[var(--radius-md)] p-4 bg-surface-low border border-outline-variant/20 flex items-start gap-3">
                    <div className="p-2.5 rounded-[var(--radius-sm)] bg-primary-container text-on-primary-container flex-shrink-0">
                      <CalendarDays size={20} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="type-body-md font-semibold text-on-surface">
                        {schedule?.dateLine}
                      </span>
                      {schedule?.timeLine && (
                        <span className="type-body-sm text-on-surface-variant">
                          {schedule.timeLine}
                        </span>
                      )}
                    </div>
                  </div>

                  {metadata.location && (
                    <div className="rounded-[var(--radius-md)] p-4 bg-surface-low border border-outline-variant/20 flex items-start gap-3">
                      <div className="p-2.5 rounded-[var(--radius-sm)] bg-secondary-container/40 text-on-secondary-container flex-shrink-0">
                        <MapPin size={20} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="type-body-md font-semibold text-on-surface break-words">
                          {metadata.location}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Map (mobile shows it here, below the bento) */}
                {(metadata.location || metadata.geohash) && (
                  <div className="md:hidden mt-1">
                    <NovaEventMap
                      location={metadata.location}
                      geohash={metadata.geohash}
                    />
                  </div>
                )}

                <div className="h-px w-full bg-outline-variant/30 my-2" />

                {/* About */}
                <div className="flex flex-col gap-3">
                  <h2 className="type-headline-md text-on-surface">
                    About this event
                  </h2>
                  {mainText ? (
                    <p className="type-body-md text-on-surface-variant whitespace-pre-line break-words">
                      {mainText}
                    </p>
                  ) : (
                    <p className="type-body-md text-on-surface-variant opacity-60">
                      No description provided.
                    </p>
                  )}
                </div>

                {/* References */}
                {references.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {references.map((ref, i) => (
                      <a
                        key={`${ref}-${i}`}
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 type-body-sm text-primary hover:underline break-all"
                      >
                        <Link2 size={14} className="flex-shrink-0" />
                        {ref}
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right column — sticky action card */}
        <div className="md:col-span-4 flex flex-col gap-6">
          <div className="rounded-[var(--radius-lg)] p-5 bg-surface-low border border-outline-variant/20 shadow-[var(--shadow-card)] md:sticky md:top-24 flex flex-col gap-5">
            {event ? (
              <>
                <NovaEventRsvp event={event} />
                {metadata && (
                  <NovaAddToCalendar
                    event={{
                      kind: event.kind,
                      title: metadata.title || "Event",
                      start: metadata.start,
                      end: metadata.end,
                      location: metadata.location,
                      description: shortDescription || mainText,
                      url:
                        typeof window !== "undefined"
                          ? window.location.href
                          : undefined,
                    }}
                  />
                )}
              </>
            ) : (
              <ActionSkeleton />
            )}
          </div>

          {/* Map (desktop shows it in the sidebar) */}
          {metadata && (metadata.location || metadata.geohash) && (
            <div className="hidden md:block">
              <NovaEventMap
                location={metadata.location}
                geohash={metadata.geohash}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded-full bg-surface-high" />
        <div className="h-6 w-24 rounded-full bg-surface-high" />
      </div>
      <div className="h-8 w-3/4 rounded bg-surface-high" />
      <div className="h-4 w-1/3 rounded bg-surface-high" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
        <div className="h-20 rounded-[var(--radius-md)] bg-surface-high" />
        <div className="h-20 rounded-[var(--radius-md)] bg-surface-high" />
      </div>
    </div>
  );
}

function ActionSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-4 w-1/2 rounded bg-surface-high" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-14 rounded-[var(--radius-md)] bg-surface-high" />
        <div className="h-14 rounded-[var(--radius-md)] bg-surface-high" />
        <div className="h-14 rounded-[var(--radius-md)] bg-surface-high" />
      </div>
    </div>
  );
}
