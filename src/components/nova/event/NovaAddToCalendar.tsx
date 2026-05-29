"use client";

import { CalendarPlus, Download } from "lucide-react";
import {
  buildGoogleCalendarUrl,
  downloadIcs,
  type CalendarEventInput,
} from "./calendarLinks";

export function NovaAddToCalendar({ event }: { event: CalendarEventInput }) {
  const googleUrl = buildGoogleCalendarUrl(event);
  if (!event.start) return null;

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
            className="flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] bg-surface-base hover:bg-surface-high transition-colors type-body-sm text-on-surface"
          >
            <CalendarPlus size={16} className="text-primary" />
            Google
          </a>
        )}
        <button
          type="button"
          onClick={() => downloadIcs(event)}
          className="flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] bg-surface-base hover:bg-surface-high transition-colors type-body-sm text-on-surface"
        >
          <Download size={16} className="text-primary" />
          .ics file
        </button>
      </div>
    </div>
  );
}
