"use client";

// The feed visibility gate, shared by /list and /map so the two views can never
// drift. An event is hidden from the feed when ANY of these hold:
//   - the user explicitly hid or reported it     (isRemovedFromView)
//   - its taste score fell under the threshold   (low_like_score)
//   - its description is empty / too short        (short_text)
//
// The latter two are the same algorithmic signals the /spam page reports; this
// hook is where they actually remove events from view (the /spam page only
// lists them). A fresh user with no feedback sees every event's score at ~0,
// so low_like_score hides nothing until they start disliking/reporting; the
// short_text gate is content-only and applies immediately.

import { useMemo } from "react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { useTasteRows, eventCoordinate, isRemovedFromView } from "./feedback";
import { useEventScores, scoreOf, HIDDEN_SCORE_THRESHOLD } from "./scores";
import { isShortText } from "./spam";

export interface VisibleEvents {
  /** The events that survive every visibility gate, input order preserved. */
  visible: NDKEvent[];
  /**
   * coordinate → like_score for the (non-user-hidden) input set. Exposed so
   * callers that also sort by taste reuse this map instead of recomputing.
   */
  scores: ReadonlyMap<string, number>;
}

/**
 * Apply the shared feed visibility gate to `events`. Pass the raw store
 * snapshot; day/tag/location filtering happens downstream on the result.
 */
export function useVisibleEvents(events: NDKEvent[]): VisibleEvents {
  const tasteRows = useTasteRows();

  // User-hidden/reported events drop out first — no point scoring events that
  // are already gone.
  const notRemoved = useMemo(
    () =>
      events.filter((e) => {
        const coordinate = eventCoordinate(e);
        return !isRemovedFromView(coordinate ? tasteRows.get(coordinate) : undefined);
      }),
    [events, tasteRows]
  );

  // Scores are now resolved over the whole working set (not just when a taste
  // sort is active), because the low_like_score gate needs them on every view.
  const scores = useEventScores(notRemoved);

  const visible = useMemo(
    () =>
      notRemoved.filter((e) => {
        if (isShortText(getEventMetadata(e).content)) return false;
        return scoreOf(scores, eventCoordinate(e)) >= HIDDEN_SCORE_THRESHOLD;
      }),
    [notRemoved, scores]
  );

  return { visible, scores };
}
