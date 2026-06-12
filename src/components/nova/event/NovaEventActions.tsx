"use client";

import { Heart, ThumbsDown, Flag, EyeOff } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { cn } from "@/lib/utils";
import {
  useEventTaste,
  eventCoordinate,
  setReaction,
  recordReport,
  setHidden,
} from "@/lib/taste/feedback";

/**
 * Floating hero actions, wired to the local taste engine (like-dislike.md):
 * the like/dislike pair plus hide and the visually distinct report flag — all
 * four directly visible on the cover image, mirroring the /list event cards
 * (EventCardActions) but at the larger hero size. Nothing is published; all
 * feedback stays on this device.
 */
export function NovaEventActions({ event }: { event: NDKEvent }) {
  const taste = useEventTaste(eventCoordinate(event));
  const liked = taste?.clicked_like != null;
  const disliked = taste?.clicked_dislike != null;
  const reported = taste?.clicked_report != null;
  const hidden = taste?.clicked_hide != null;

  const buttonClass = (active: boolean) =>
    cn(
      "flex items-center justify-center w-11 h-11 rounded-full shadow-lg",
      "bg-surface/80 backdrop-blur-md transition-colors active:scale-95",
      active ? "text-error" : "text-primary hover:bg-surface"
    );

  function handleReport() {
    if (reported) return;
    if (!window.confirm("Report this event as spam? This cannot be undone.")) return;
    void recordReport(event);
  }

  return (
    <div className="absolute top-4 right-4 flex gap-2">
      <button
        type="button"
        aria-label={liked ? "Remove like" : "Like event"}
        aria-pressed={liked}
        onClick={() => void setReaction(event, liked ? null : "like")}
        className={buttonClass(liked)}
      >
        <Heart size={20} fill={liked ? "currentColor" : "none"} />
      </button>

      <button
        type="button"
        aria-label={disliked ? "Remove dislike" : "Dislike event"}
        aria-pressed={disliked}
        onClick={() => void setReaction(event, disliked ? null : "dislike")}
        className={buttonClass(disliked)}
      >
        <ThumbsDown size={20} fill={disliked ? "currentColor" : "none"} />
      </button>

      <button
        type="button"
        aria-label={hidden ? "Unhide event" : "Hide event"}
        aria-pressed={hidden}
        onClick={() => void setHidden(event, !hidden)}
        className={buttonClass(hidden)}
      >
        <EyeOff size={20} />
      </button>

      <button
        type="button"
        aria-label="Report event as spam"
        onClick={handleReport}
        className={cn(
          "flex items-center justify-center w-11 h-11 rounded-full shadow-lg",
          "backdrop-blur-md transition-colors active:scale-95",
          reported
            ? "bg-error-container text-error"
            : "bg-surface/80 text-on-surface-variant hover:bg-error-container hover:text-error"
        )}
      >
        <Flag size={20} fill={reported ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
