import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { fetchEventById } from "@/utils/nostr/nostrUtils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { getNdk } from "@/lib/ndkClient";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    const ndk = getNdk();
    // Bounded fetch; on miss/timeout render a generic branded card (200)
    // rather than a broken 404 image for the crawler.
    const event = await fetchEventById(ndk, eventId, { timeoutMs: 3000 });
    const metadata =
      event && (event.kind === 31922 || event.kind === 31923)
        ? getEventMetadata(event)
        : null;

    const title = metadata?.title || "Event on Meetstr";
    const description =
      metadata?.summary || event?.content || "Discover Nostr calendar events";
    const location = metadata?.location || "";

    // Format date
    const startTimestamp = metadata?.start ? parseInt(metadata.start) : null;
    const startDate = startTimestamp
      ? new Date(startTimestamp * 1000).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";

    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px",
            color: "white",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 30,
              lineHeight: 1.2,
              maxWidth: "90%",
            }}
          >
            {title}
          </div>

          {startDate && (
            <div
              style={{
                fontSize: 28,
                marginBottom: 20,
                opacity: 0.9,
                fontWeight: 500,
              }}
            >
              📅 {startDate}
            </div>
          )}

          {location && (
            <div
              style={{
                fontSize: 24,
                marginBottom: 20,
                opacity: 0.8,
                display: "flex",
                alignItems: "center",
              }}
            >
              📍 {location}
            </div>
          )}

          <div
            style={{
              fontSize: 20,
              textAlign: "center",
              opacity: 0.9,
              maxWidth: "80%",
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 40,
              right: 40,
              fontSize: 20,
              opacity: 0.8,
            }}
          >
            meetstr.com
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error("Error generating event OG image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
