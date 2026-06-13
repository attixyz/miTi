"use client";

import { useMemo } from "react";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import { Clock, MapPin, Navigation } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import {
  formatInZone,
  tzAbbreviation,
  TIME_OPTS,
} from "../event/eventSchedule";
import { EventCardActions } from "./EventCardActions";

// Compact date used on multi-day feeds, e.g. "Thu, Oct 15" (no year).
const CARD_DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

function getEventHref(event: NDKEvent): string {
  try {
    const dTag = event.tags.find((t) => t[0] === "d")?.[1] || "";
    const naddr = nip19.naddrEncode({
      kind: event.kind!,
      pubkey: event.pubkey,
      identifier: dTag,
    });
    return `/event/${naddr}`;
  } catch {
    return "#";
  }
}

// Times render in the event's own timezone (start_tzid/end_tzid) — matching the
// detail page (eventSchedule.ts) — not the viewer's browser zone. Invalid IANA
// ids fall back to local via formatInZone.
function formatEventTime(event: NDKEvent, showDate = false): string {
  const metadata = getEventMetadata(event);

  // Date-based events (31922) run all day; `start` is an ISO date string.
  if (event.kind === 31922) {
    if (!metadata.start) return "";
    // On feeds that mix multiple days (e.g. /suggested) the card carries the
    // date too; day-scoped feeds (the list's day switcher) leave it off.
    const date = new Date(`${metadata.start}T00:00:00`);
    const datePart =
      showDate && !isNaN(date.getTime())
        ? formatInZone(date, CARD_DATE_OPTS)
        : "";
    return datePart ? `${datePart} · All day` : "All day";
  }

  // Time-based events (31923): `start`/`end` are Unix timestamps.
  if (!metadata.start) return "";
  const startTs = parseInt(metadata.start, 10);
  if (isNaN(startTs)) return "";
  const startDate = new Date(startTs * 1000);
  const startTz = metadata.start_tzid || undefined;

  const datePart = showDate ? formatInZone(startDate, CARD_DATE_OPTS, startTz) : "";

  let timePart = formatInZone(startDate, TIME_OPTS, startTz);
  const endTs = metadata.end ? parseInt(metadata.end, 10) : NaN;
  if (!isNaN(endTs)) {
    const endTz = metadata.end_tzid || startTz;
    timePart = `${timePart} – ${formatInZone(new Date(endTs * 1000), TIME_OPTS, endTz)}`;
  }

  // Tag the zone so viewers know it isn't their local time (e.g. "7:00 PM JST").
  const abbr = tzAbbreviation(startDate, startTz);
  if (abbr) timePart = `${timePart} ${abbr}`;

  return datePart ? `${datePart} · ${timePart}` : timePart;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function NovaEventCard({
  event,
  showDate = false,
  distanceKm,
}: {
  event: NDKEvent;
  /** Prefix the time row with the event's date (for multi-day feeds). */
  showDate?: boolean;
  /** Distance from the active location filter, in km, when known. */
  distanceKm?: number | null;
}) {
  const metadata = useMemo(() => getEventMetadata(event), [event]);
  const href = useMemo(() => getEventHref(event), [event]);
  const timeStr = useMemo(() => formatEventTime(event, showDate), [event, showDate]);
  const summary = metadata.shortDescription as string | undefined;

  return (
    <Link href={href} className="block group h-full">
      <article
        className={cn(
          "h-full flex flex-col rounded-[var(--radius-xl)] overflow-hidden",
          "bg-surface-low border border-outline-variant/40",
          "transition-shadow duration-300 hover:shadow-[var(--shadow-overlay)]"
        )}
      >
        <div className="aspect-video w-full relative overflow-hidden bg-surface-high flex-shrink-0">
          {metadata.image ? (
            <img
              src={metadata.image}
              alt={metadata.title || ""}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-container/40 to-primary/20 flex items-center justify-center">
              <span className="text-4xl opacity-20">📅</span>
            </div>
          )}
          <EventCardActions event={event} />
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1">
          <h2 className="type-body-md font-semibold text-on-surface leading-snug line-clamp-2">
            {metadata.title || "Untitled Event"}
          </h2>

          <div className="flex flex-col gap-1.5 mt-0.5">
            {timeStr && (
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <Clock size={14} className="text-primary flex-shrink-0" />
                <span className="type-body-sm">{timeStr}</span>
              </div>
            )}
            {metadata.location && (
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <MapPin size={14} className="text-primary flex-shrink-0" />
                <span className="type-body-sm truncate">{metadata.location}</span>
              </div>
            )}
            {distanceKm != null && (
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <Navigation size={14} className="text-primary flex-shrink-0" />
                <span className="type-body-sm">{formatDistance(distanceKm)} away</span>
              </div>
            )}
          </div>

          {metadata.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
              {(metadata.hashtags as string[]).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-surface-high text-on-surface-variant text-[11px] font-semibold capitalize"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {summary && (
            <p className="type-body-sm text-on-surface-variant line-clamp-3">
              {summary.length > 140 ? `${summary.slice(0, 140)}…` : summary}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
