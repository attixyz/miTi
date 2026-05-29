// Client-side "Add to Calendar" helpers — no server round-trip.
// Builds a Google Calendar template URL and a downloadable .ics blob for a
// single NIP-52 event.

export interface CalendarEventInput {
  kind?: number;
  title: string;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string;
}

/** "YYYYMMDDTHHMMSSZ" for time-based events (Unix timestamp → UTC). */
function toUtcStamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** "YYYYMMDD" for all-day events (ISO date string). */
function toDateStamp(isoDate: string): string {
  return isoDate.replace(/-/g, "").slice(0, 8);
}

interface Stamps {
  start: string;
  end: string;
  allDay: boolean;
}

function resolveStamps(input: CalendarEventInput): Stamps | null {
  if (!input.start) return null;

  if (input.kind === 31922) {
    const start = toDateStamp(input.start);
    // Google/iCal treat the all-day end date as exclusive; default to +1 day.
    const endIso = input.end || input.start;
    const endDate = new Date(`${endIso}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    const end = endDate.toISOString().slice(0, 10).replace(/-/g, "");
    return { start, end, allDay: true };
  }

  const startTs = parseInt(input.start, 10);
  if (isNaN(startTs)) return null;
  const endTs = input.end ? parseInt(input.end, 10) : startTs + 3600;
  return {
    start: toUtcStamp(startTs),
    end: toUtcStamp(isNaN(endTs) ? startTs + 3600 : endTs),
    allDay: false,
  };
}

export function buildGoogleCalendarUrl(input: CalendarEventInput): string | null {
  const stamps = resolveStamps(input);
  if (!stamps) return null;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title || "Event",
    dates: `${stamps.start}/${stamps.end}`,
  });
  if (input.description) params.set("details", input.description);
  if (input.location) params.set("location", input.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(input: CalendarEventInput): string | null {
  const stamps = resolveStamps(input);
  if (!stamps) return null;

  const dtStart = stamps.allDay
    ? `DTSTART;VALUE=DATE:${stamps.start}`
    : `DTSTART:${stamps.start}`;
  const dtEnd = stamps.allDay
    ? `DTEND;VALUE=DATE:${stamps.end}`
    : `DTEND:${stamps.end}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meetstr//NIP-52//EN",
    "BEGIN:VEVENT",
    `UID:${(input.url || input.title || "meetstr") + "@meetstr"}`,
    `DTSTAMP:${toUtcStamp(Math.floor(Date.now() / 1000))}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcs(input.title || "Event")}`,
    input.description ? `DESCRIPTION:${escapeIcs(input.description)}` : "",
    input.location ? `LOCATION:${escapeIcs(input.location)}` : "",
    input.url ? `URL:${escapeIcs(input.url)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

/** Triggers a client-side download of the event as an .ics file. */
export function downloadIcs(input: CalendarEventInput): void {
  const ics = buildIcs(input);
  if (!ics) return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(input.title || "event").replace(/[^\w-]+/g, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
