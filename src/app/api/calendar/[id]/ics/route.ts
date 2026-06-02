import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getNdk } from "@/lib/ndkClient";
import { fetchCalendarEvents, fetchEventById } from "@/utils/nostr/nostrUtils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { getBaseUrlFromHeaders, ICS_UID_DOMAIN } from "@/lib/baseUrl";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: calendarNaddr } = await context.params;

  const ndk = getNdk();

  // Fetch calendar event. This endpoint is polled by calendar apps, so bound
  // the lookup (3s) and honour any relay hints in the naddr (with a fallback to
  // the default pool) so a slow/missing relay can't blank out the subscription.
  const calendarEvent = await fetchEventById(ndk, calendarNaddr, {
    timeoutMs: 3000,
    useRelayHints: true,
  });
  if (!calendarEvent || calendarEvent.kind !== 31924) {
    return NextResponse.json(
      { error: "Invalid calendar ID or event not found" },
      { status: 404 }
    );
  }

  const calendarMetadata = getEventMetadata(calendarEvent);
  const { upcoming, past } = await fetchCalendarEvents(ndk, calendarEvent);
  const allEvents = [...upcoming, ...past];

  // Generate ICS content. The clickable `URL:` field tracks the host the feed
  // was fetched from; the `UID` namespace stays a fixed constant (see below).
  const baseUrl = getBaseUrlFromHeaders(req.headers);
  const icsContent = generateICSContent(calendarMetadata, allEvents, baseUrl);

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendarMetadata.title || "miTi-calendar"}.ics"`,
      "Cache-Control": "no-cache, must-revalidate",
      "X-Published-TTL": "PT1H", // Refresh every hour
    },
  });
}

function generateICSContent(
  calendarMetadata: any,
  events: any[],
  baseUrl: string
): string {
  const now = new Date();
  const formatDate = (timestamp: string | number | undefined | null) => {
    if (
      timestamp === undefined ||
      timestamp === null ||
      isNaN(Number(timestamp))
    )
      return "";
    const num = typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
    if (!isFinite(num)) return "";
    const date = new Date(num * 1000);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const escapeText = (text: string) => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//miTi//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarMetadata.title || "miTi Calendar")}`,
    `X-WR-CALDESC:${escapeText(calendarMetadata.summary || "")}`,
    "X-WR-TIMEZONE:UTC",
    `LAST-MODIFIED:${formatDate(now.getTime() / 1000)}`,
  ];

  events.forEach((event) => {
    const metadata = getEventMetadata(event);
    // Ensure start is a valid UNIX timestamp (seconds)
    const startTimestamp = Number(metadata.start);
    if (!startTimestamp || !isFinite(startTimestamp)) return;

    const startDate = formatDate(startTimestamp);

    // If end is present and valid, use it; otherwise, default to 1 hour after start
    let endTimestamp: number;
    if (metadata.end && isFinite(Number(metadata.end))) {
      endTimestamp = Number(metadata.end);
    } else {
      endTimestamp = startTimestamp + 3600; // Default 1 hour duration
    }
    const endDate = formatDate(endTimestamp);

    ics.push(
      "BEGIN:VEVENT",
      // UID namespace is a FIXED constant — must stay stable across hosts so
      // re-downloads update events instead of duplicating them (RFC 5545).
      `UID:${event.id}@${ICS_UID_DOMAIN}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${escapeText(metadata.title || "Untitled Event")}`,
      `DESCRIPTION:${escapeText(metadata.summary || "")}`,
      metadata.location ? `LOCATION:${escapeText(metadata.location)}` : "",
      `URL:${baseUrl}/event/${event.id}`,
      `CREATED:${formatDate(event.created_at)}`,
      `LAST-MODIFIED:${formatDate(event.created_at)}`,
      "END:VEVENT"
    );
  });

  ics.push("END:VCALENDAR");

  return ics.filter((line) => line !== "").join("\r\n");
}
