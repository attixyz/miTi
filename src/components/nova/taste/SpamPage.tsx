"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import { useNdk } from "nostr-hooks";
import { ShieldAlert } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { eventCoordinate } from "@/lib/taste/feedback";
import { useEventScores, scoreOf, HIDDEN_SCORE_THRESHOLD } from "@/lib/taste/scores";
import { mainTextWordCount, SHORT_TEXT_MIN_WORDS } from "@/lib/taste/spam";
import { useEventsStore, ensureFreshEvents } from "../events/eventsStore";

type SpamReason = "low_like_score" | "short_text";

const REASON_LABELS: Record<SpamReason, string> = {
  low_like_score: "low like score",
  short_text: "short text",
};

interface SpamRow {
  coordinate: string;
  event: NDKEvent;
  reasons: SpamReason[];
  like_score: number;
  word_count: number;
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
 * /your-feedback, which lists events the user explicitly acted on, this page is
 * PURELY algorithmic: it scans the loaded events and flags the ones whose taste
 * score fell under the hidden threshold (low_like_score) or whose main text is
 * empty/too short (short_text). User-hidden and user-reported events are NOT
 * listed here — they already live under /your-feedback.
 */
export function SpamPage() {
  const { ndk } = useNdk();
  const { events: storeEvents } = useEventsStore();

  useEffect(() => {
    if (ndk) ensureFreshEvents(ndk);
  }, [ndk]);

  const scores = useEventScores(storeEvents);

  const rows = useMemo<SpamRow[]>(() => {
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
      result.push({
        coordinate,
        event,
        reasons,
        like_score: score,
        word_count: wordCount,
      });
    }
    // Worst taste first.
    return result.sort((a, b) => a.like_score - b.like_score);
  }, [storeEvents, scores]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:py-8">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-on-surface">
        Spam filter
      </h1>
      <p className="mb-6 text-xs text-on-surface-variant">
        Events the filter flags automatically — a taste score under{" "}
        {HIDDEN_SCORE_THRESHOLD}, or fewer than {SHORT_TEXT_MIN_WORDS} words of
        description. Events you hid or reported yourself live under{" "}
        <Link href="/your-feedback" className="underline">
          your feedback
        </Link>
        .
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ShieldAlert size={36} className="text-on-surface-variant opacity-30" />
          <p className="type-body-md text-on-surface-variant">
            Nothing looks like spam.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface/80">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant/70">
                <th className="px-4 py-2 font-semibold">Title</th>
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
