"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import { useNdk } from "nostr-hooks";
import { ShieldAlert } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Dayjs } from "dayjs";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { formatDayjsDateTime } from "@/utils/formatting/date";
import { eventCoordinate } from "@/lib/taste/feedback";
import { useEventScores, scoreOf, HIDDEN_SCORE_THRESHOLD } from "@/lib/taste/scores";
import { mainTextWordCount, SHORT_TEXT_MIN_WORDS } from "@/lib/taste/spam";
import { useEventsStore, ensureFreshEvents, getEventStart } from "../events/eventsStore";

type SpamReason = "low_like_score" | "short_text";

const REASON_LABELS: Record<SpamReason, string> = {
  low_like_score: "low like score",
  short_text: "short text",
};

/** Which side of "now" the table shows. */
type TimeFilter = "future" | "past";

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "past", label: "Past" },
  { value: "future", label: "Future" },
];

interface SpamRow {
  coordinate: string;
  event: NDKEvent;
  reasons: SpamReason[];
  like_score: number;
  word_count: number;
  start: Dayjs;
}

function eventHref(coordinate: string): string | null {
  const [kindRaw, pubkey, ...dParts] = coordinate.split(":");
  try {
    return `/event/${nip19.naddrEncode({
      kind: Number(kindRaw),
      pubkey,
      identifier: dParts.join(":"),
    })}`;
  } catch {
    return null;
  }
}

/**
 * /spam — the algorithmic spam filter (like-dislike.md, "/hidden"). Unlike
 * /my-feedback, which lists events the user explicitly acted on, this page is
 * PURELY algorithmic: it scans the loaded events and flags the ones whose taste
 * score fell under the hidden threshold (low_like_score) or whose main text is
 * empty/too short (short_text). User-hidden and user-reported events are NOT
 * listed here — they already live under /my-feedback. The Past/Future toggle
 * splits the flagged set on the event start time.
 */
export function SpamPage() {
  const { ndk } = useNdk();
  const { events: storeEvents } = useEventsStore();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("future");

  useEffect(() => {
    if (ndk) ensureFreshEvents(ndk);
  }, [ndk]);

  const scores = useEventScores(storeEvents);

  const rows = useMemo<SpamRow[]>(() => {
    const now = Date.now();
    const result: SpamRow[] = [];
    for (const event of storeEvents) {
      const coordinate = eventCoordinate(event);
      if (!coordinate) continue;
      const score = scoreOf(scores, coordinate);
      const wordCount = mainTextWordCount(getEventMetadata(event).content ?? "");
      const reasons: SpamReason[] = [];
      if (score < HIDDEN_SCORE_THRESHOLD) reasons.push("low_like_score");
      if (wordCount < SHORT_TEXT_MIN_WORDS) reasons.push("short_text");
      if (reasons.length === 0) continue;

      // Keep only the side of "now" the toggle selected.
      const start = getEventStart(event);
      if (!start) continue;
      const isFuture = start.valueOf() >= now;
      if (timeFilter === "future" ? !isFuture : isFuture) continue;

      result.push({
        coordinate,
        event,
        reasons,
        like_score: score,
        word_count: wordCount,
        start,
      });
    }
    // Future: soonest first (ascending); past: most recent first (descending).
    return result.sort((a, b) =>
      timeFilter === "future"
        ? a.start.valueOf() - b.start.valueOf()
        : b.start.valueOf() - a.start.valueOf()
    );
  }, [storeEvents, scores, timeFilter]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:py-8">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-on-surface">
        Spam filter
      </h1>
      <p className="mb-4 text-xs text-on-surface-variant">
        Events the filter flags automatically — a taste score under{" "}
        {HIDDEN_SCORE_THRESHOLD}, or fewer than {SHORT_TEXT_MIN_WORDS} words of
        description. Events you hid or reported yourself live under{" "}
        <Link href="/my-feedback" className="underline">
          my feedback
        </Link>
        .
      </p>

      <div
        role="group"
        aria-label="Time filter"
        className="mb-6 inline-flex overflow-hidden rounded-full border border-outline-variant/40"
      >
        {TIME_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={timeFilter === value}
            onClick={() => setTimeFilter(value)}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold transition-colors",
              timeFilter === value
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-high"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ShieldAlert size={36} className="text-on-surface-variant opacity-30" />
          <p className="type-body-md text-on-surface-variant">
            Nothing looks like spam.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border border-outline-variant/30 bg-surface/80">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant/70">
                <th className="px-4 py-2 font-semibold">Title</th>
                <th className="px-4 py-2 font-semibold">Start</th>
                <th className="px-4 py-2 font-semibold">Reason</th>
                <th className="px-4 py-2 text-right font-semibold">Words</th>
                <th className="px-4 py-2 text-right font-semibold">Like score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <SpamTableRow key={row.coordinate} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SpamTableRow({ row }: { row: SpamRow }) {
  const title = getEventMetadata(row.event).title || "Untitled Event";
  const href = eventHref(row.coordinate);

  return (
    <tr className="border-t border-outline-variant/15">
      <td className="max-w-[16rem] px-4 py-2 text-on-surface">
        {href ? (
          <Link href={href} className="line-clamp-2 hover:underline">
            {title}
          </Link>
        ) : (
          <span className="line-clamp-2">{title}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-on-surface-variant">
        {formatDayjsDateTime(row.start)}
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap gap-1">
          {row.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-surface-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant"
            >
              {REASON_LABELS[reason]}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-on-surface-variant">
        {row.word_count}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-on-surface-variant">
        {row.like_score.toFixed(3)}
      </td>
    </tr>
  );
}
