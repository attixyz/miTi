"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { NovaEventHost } from "@/components/nova/event/NovaEventHost";
import {
  getCalendarHref,
  getCalendarEventCount,
} from "./useNovaCalendars";

export function NovaCalendarCard({ calendar }: { calendar: NDKEvent }) {
  const metadata = useMemo(() => getEventMetadata(calendar), [calendar]);
  const href = useMemo(() => getCalendarHref(calendar), [calendar]);
  const count = getCalendarEventCount(calendar);

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
              <CalendarRange size={32} className="text-primary/40" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span
              className={cn(
                "bg-surface/85 backdrop-blur-sm text-primary",
                "text-[11px] font-semibold uppercase tracking-wider",
                "px-2.5 py-1 rounded-full border border-outline-variant/20"
              )}
            >
              {count} event{count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1">
          <h2 className="type-body-md font-semibold text-on-surface leading-snug line-clamp-2">
            {metadata.title || "Untitled Calendar"}
          </h2>

          {metadata.summary && (
            <p className="type-body-sm text-on-surface-variant line-clamp-2">
              {metadata.summary}
            </p>
          )}

          <div className="mt-auto pt-1">
            <NovaEventHost pubkey={calendar.pubkey} noLink />
          </div>
        </div>
      </article>
    </Link>
  );
}
