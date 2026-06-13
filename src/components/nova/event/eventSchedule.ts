// Timezone-aware date/time formatting for NIP-52 calendar events.
//
// This fixes the *display* half of the timezone bug (CLAUDE.md → "Timezone
// handling"): `start_tzid`/`end_tzid` are now passed through to the formatter
// so a Tokyo event reads in Tokyo time regardless of the viewer's locale.
// The *saving* half (creating timestamps in the wrong zone) is Phase 4.

import { getUserLocale } from "@/utils/formatting/date";

export interface EventScheduleInput {
  kind?: number;
  start?: string | null;
  end?: string | null;
  start_tzid?: string | null;
  end_tzid?: string | null;
}

export interface EventSchedule {
  /** Primary date line, e.g. "Mon, Oct 15, 2024" or "Oct 15 – 17, 2024". */
  dateLine: string;
  /** Secondary time line, e.g. "9:00 AM – 5:00 PM EST" or "All day". */
  timeLine: string;
}

const DATE_TBA: EventSchedule = { dateLine: "Date to be announced", timeLine: "" };

function locale(): string {
  return getUserLocale();
}

/** Returns the short timezone abbreviation (e.g. "EST", "GMT+9") for a date. */
export function tzAbbreviation(date: Date, tzid?: string | null): string {
  if (!tzid) return "";
  try {
    const parts = new Intl.DateTimeFormat(locale(), {
      timeZone: tzid,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function formatInZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  tzid?: string | null
): string {
  try {
    return new Intl.DateTimeFormat(locale(), {
      ...options,
      ...(tzid ? { timeZone: tzid } : {}),
    }).format(date);
  } catch {
    // Invalid IANA identifier → fall back to the viewer's local zone.
    return new Intl.DateTimeFormat(locale(), options).format(date);
  }
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
};

export const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

/** Whether two instants land on the same calendar day in a given timezone. */
function sameDayInZone(a: Date, b: Date, tzid?: string | null): boolean {
  const key = (d: Date) =>
    formatInZone(d, { year: "numeric", month: "2-digit", day: "2-digit" }, tzid);
  return key(a) === key(b);
}

/** Date-based events (kind 31922): `start`/`end` are ISO 8601 date strings. */
function formatDateBased(input: EventScheduleInput): EventSchedule {
  if (!input.start) return DATE_TBA;
  const start = new Date(`${input.start}T00:00:00`);
  if (isNaN(start.getTime())) return DATE_TBA;

  const end = input.end ? new Date(`${input.end}T00:00:00`) : null;
  const hasEnd = end && !isNaN(end.getTime()) && end.getTime() > start.getTime();

  if (hasEnd && end) {
    const sameMonth =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth();
    const startStr = formatInZone(start, { month: "short", day: "numeric" });
    const endStr = formatInZone(
      end,
      sameMonth
        ? { day: "numeric", year: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" }
    );
    return { dateLine: `${startStr} – ${endStr}`, timeLine: "All day" };
  }

  return {
    dateLine: formatInZone(start, DATE_OPTS),
    timeLine: "All day",
  };
}

/** Time-based events (kind 31923): `start`/`end` are Unix timestamps. */
function formatTimeBased(input: EventScheduleInput): EventSchedule {
  const startTs = input.start ? parseInt(input.start, 10) : NaN;
  if (isNaN(startTs)) return DATE_TBA;

  const startDate = new Date(startTs * 1000);
  const startTz = input.start_tzid || undefined;

  const endTs = input.end ? parseInt(input.end, 10) : NaN;
  const endDate = !isNaN(endTs) ? new Date(endTs * 1000) : null;
  const endTz = input.end_tzid || startTz;

  const startTime = formatInZone(startDate, TIME_OPTS, startTz);
  const startAbbr = tzAbbreviation(startDate, startTz);

  if (!endDate) {
    return {
      dateLine: formatInZone(startDate, DATE_OPTS, startTz),
      timeLine: startAbbr ? `${startTime} ${startAbbr}` : startTime,
    };
  }

  const endTime = formatInZone(endDate, TIME_OPTS, endTz);
  const endAbbr = tzAbbreviation(endDate, endTz);

  if (sameDayInZone(startDate, endDate, startTz)) {
    // "9:00 AM – 5:00 PM EST" — collapse the abbreviation when it's shared.
    const tail =
      startAbbr && startAbbr === endAbbr
        ? ` ${startAbbr}`
        : endAbbr
          ? ` ${endAbbr}`
          : "";
    const startWithAbbr =
      startAbbr && startAbbr !== endAbbr ? `${startTime} ${startAbbr}` : startTime;
    return {
      dateLine: formatInZone(startDate, DATE_OPTS, startTz),
      timeLine: `${startWithAbbr} – ${endTime}${tail}`,
    };
  }

  // Multi-day, time-based: show both endpoints in full.
  const startFull = `${formatInZone(startDate, { month: "short", day: "numeric" }, startTz)}, ${startTime}${startAbbr ? ` ${startAbbr}` : ""}`;
  const endFull = `${formatInZone(endDate, { month: "short", day: "numeric", year: "numeric" }, endTz)}, ${endTime}${endAbbr ? ` ${endAbbr}` : ""}`;
  return {
    dateLine: `${startFull} – ${endFull}`,
    timeLine: "",
  };
}

export function formatEventSchedule(input: EventScheduleInput): EventSchedule {
  if (input.kind === 31922) return formatDateBased(input);
  return formatTimeBased(input);
}
