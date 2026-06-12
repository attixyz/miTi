"use client";

import { useMemo } from "react";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import { Clock, MapPin } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { getEventStart } from "./useNovaEvents";
import { EventCardActions } from "./EventCardActions";

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

function formatEventTime(event: NDKEvent): string {
  // Date-based events (31922) have no specific time — they run all day.
  if (event.kind === 31922) {
    return "All day";
  }

  // Time-based events (31923) without a start time show nothing.
  const metadata = getEventMetadata(event);
  if (!metadata.start) return "";

  const start = getEventStart(event);
  if (!start) return "";

  const timeStr = start.format("h:mm A");
  if (!metadata.end) return timeStr;

  const endTs = parseInt(metadata.end);
  if (isNaN(endTs)) return timeStr;

  return `${timeStr} – ${dayjs.unix(endTs).format("h:mm A")}`;
}

export function NovaEventCard({ event }: { event: NDKEvent }) {
  const metadata = useMemo(() => getEventMetadata(event), [event]);
  const href = useMemo(() => getEventHref(event), [event]);
  const timeStr = useMemo(() => formatEventTime(event), [event]);
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
