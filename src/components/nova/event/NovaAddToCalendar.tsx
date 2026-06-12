"use client";

import { CalendarPlus, Download } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { recordAddToCalendar } from "@/lib/taste/feedback";
import {
  buildGoogleCalendarUrl,
  downloadIcs,
  type CalendarEventInput,
} from "./calendarLinks";

export function NovaAddToCalendar({
  event,
  ndkEvent,
}: {
  event: CalendarEventInput;
  /** Source event for the taste engine; each click records intent points. */
  ndkEvent: NDKEvent;
}) {
  const googleUrl = buildGoogleCalendarUrl(event);
  if (!event.start) return null;

  // The app only ever sees the click — the add itself is unverifiable, and
  // repeats are tolerated by design (like-dislike.md, add_to_calendar).
  const recordClick = () => void recordAddToCalendar(ndkEvent);

  return (
    <div className="flex flex-col gap-2">
      <span className="type-label-sm uppercase text-on-surface-variant">
        Add to calendar
      </span>
      <div className="grid grid-cols-2 gap-2">
        {googleUrl && (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={recordClick}
            className="flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] bg-surface-base hover:bg-surface-high transition-colors type-body-sm text-on-surface"
          >
            <CalendarPlus size={16} className="text-primary" />
            Google
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            recordClick();
            downloadIcs(event);
          }}
          className="flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] bg-surface-base hover:bg-surface-high transition-colors type-body-sm text-on-surface"
        >
          <Download size={16} className="text-primary" />
          .ics file
        </button>
      </div>
    </div>
  );
}
