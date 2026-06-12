"use client";

import { useMemo } from "react";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import { EyeOff } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import {
  useTasteRows,
  eventCoordinate,
  setHiddenByCoordinate,
} from "@/lib/taste/feedback";
import { useEventScores, scoreOf, HIDDEN_SCORE_THRESHOLD } from "@/lib/taste/scores";
import { useEventsStore } from "../events/eventsStore";
import { useEventsByCoordinate } from "./useEventsByCoordinate";

type HiddenReason = "user_reported" | "user_hidden" | "low_like_score";

interface HiddenRow {
  coordinate: string;
  event: NDKEvent | undefined;
  reason: HiddenReason;
  /** The explicit user action behind the row, if any. */
  action: "hide" | "report" | null;
  like_score: number;
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
 * /hidden — table of hidden events (like-dislike.md, "UI and routes"):
 * reported, user-hidden, or like_score under the negative threshold. There is
 * no separate spam score; like_score IS the spam signal.
 */
export function HiddenPage() {
  const tasteRows = useTasteRows();
  const { events: storeEvents } = useEventsStore();

  // Rows from explicit actions (may reference events outside the store window).
  const actioned = useMemo(
    () =>
      [...tasteRows.values()].filter(
        (row) => row.clicked_report != null || row.clicked_hide != null
      ),
    [tasteRows]
  );
  const actionedCoordinates = useMemo(
    () => actioned.map((row) => row.coordinate),
    [actioned]
  );
  const actionedEvents = useEventsByCoordinate(actionedCoordinates);

  // Score everything visible on this page in one lazy pass: the whole store
  // (to find low_like_score events) plus the actioned events.
  const scorable = useMemo(
    () => [...storeEvents, ...actionedEvents.values()],
    [storeEvents, actionedEvents]
  );
  const scores = useEventScores(scorable);

  const rows = useMemo<HiddenRow[]>(() => {
    const result: HiddenRow[] = [];
    const seen = new Set<string>();

    for (const row of actioned) {
      const reported = row.clicked_report != null;
      seen.add(row.coordinate);
      result.push({
        coordinate: row.coordinate,
        event: actionedEvents.get(row.coordinate),
        // Report outranks hide as the displayed reason.
        reason: reported ? "user_reported" : "user_hidden",
        action: reported ? "report" : "hide",
        like_score: scores.get(row.coordinate) ?? row.like_score,
      });
    }

    for (const event of storeEvents) {
      const coordinate = eventCoordinate(event);
      if (!coordinate || seen.has(coordinate)) continue;
      const score = scoreOf(scores, coordinate);
      if (score < HIDDEN_SCORE_THRESHOLD) {
        result.push({
          coordinate,
          event,
          reason: "low_like_score",
          action: null,
          like_score: score,
        });
      }
    }

    // Worst taste first.
    return result.sort((a, b) => a.like_score - b.like_score);
  }, [actioned, actionedEvents, storeEvents, scores]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:py-8">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-on-surface">
        Hidden events
      </h1>
      <p className="mb-6 text-xs text-on-surface-variant">
        Events you reported or hid, plus events whose taste score fell under{" "}
        {HIDDEN_SCORE_THRESHOLD}.
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <EyeOff size={36} className="text-on-surface-variant opacity-30" />
          <p className="type-body-md text-on-surface-variant">
            Nothing is hidden.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface/80">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant/70">
                <th className="px-4 py-2 font-semibold">Title</th>
                <th className="px-4 py-2 font-semibold">Reason</th>
                <th className="px-4 py-2 font-semibold">User action</th>
                <th className="px-4 py-2 text-right font-semibold">Like score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <HiddenTableRow key={row.coordinate} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HiddenTableRow({ row }: { row: HiddenRow }) {
  const title = row.event
    ? getEventMetadata(row.event).title || "Untitled Event"
    : null;
  const href = eventHref(row.coordinate);

  return (
    <tr className="border-t border-outline-variant/15">
      <td className="max-w-[16rem] px-4 py-2 text-on-surface">
        {title && href ? (
          <Link href={href} className="line-clamp-2 hover:underline">
            {title}
          </Link>
        ) : (
          <span className="break-all text-xs text-on-surface-variant" title={row.coordinate}>
            {title ?? row.coordinate}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-on-surface-variant">{row.reason}</td>
      <td className="px-4 py-2 text-on-surface-variant">
        {row.action ?? "—"}
        {row.action === "hide" && (
          <button
            type="button"
            onClick={() => void setHiddenByCoordinate(row.coordinate, false)}
            className="ml-2 rounded-full border border-outline-variant/40 px-2 py-0.5 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-high"
          >
            Unhide
          </button>
        )}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-on-surface-variant">
        {row.like_score.toFixed(3)}
      </td>
    </tr>
  );
}
