// Action point values and applied-points reconstruction (like-dislike.md,
// "Recording feedback (delta model)").
//
// Pure module shared by the main-thread delta engine (feedback.ts) and the
// Web Worker's replay-on-reindex: both must agree on what an event_taste
// row's stored state is worth in points.

import type { EventTasteRow } from "./db";

export const ACTION_POINTS = {
  like: 100,
  dislike: -50, // thumb-down: personal taste, mild negative
  report: -100, // red flag: moderation, strong negative
  add_to_calendar: 200, // intent signal; unverifiable click, tolerated repeats
  rsvp_yes: 300,
  rsvp_maybe: 150,
  rsvp_no: 30,
} as const;

/** Mutually exclusive taste pair — setting one retracts the other. */
export type ReactionState = "like" | "dislike" | null;

/** Retractable RSVP state as the taste engine sees it. */
export type TasteRsvpState = "yes" | "maybe" | "no" | null;

export function reactionState(row: EventTasteRow | undefined): ReactionState {
  if (!row) return null;
  if (row.clicked_like != null) return "like";
  if (row.clicked_dislike != null) return "dislike";
  return null;
}

export function reactionPoints(state: ReactionState): number {
  return state == null ? 0 : ACTION_POINTS[state];
}

export function rsvpPoints(state: TasteRsvpState): number {
  if (state == null) return 0;
  return ACTION_POINTS[`rsvp_${state}`];
}

/**
 * Total points a row's stored state represents, for replaying feedback over a
 * rebuilt corpus. `added_to_calendar` is counted ONCE here even if it was
 * clicked several times — repeats are deliberately not stored, so a replay
 * loses them (the documented replay caveat; a tolerated under-count).
 * `clicked_hide` carries no points.
 */
export function appliedRowPoints(row: EventTasteRow): number {
  let points = reactionPoints(reactionState(row));
  points += rsvpPoints(row.last_rsvp_state);
  if (row.clicked_report != null) points += ACTION_POINTS.report;
  if (row.added_to_calendar != null) points += ACTION_POINTS.add_to_calendar;
  return points;
}
