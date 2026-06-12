"use client";

import { Heart, ThumbsDown, Flag, EyeOff } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import {
  useEventTaste,
  eventCoordinate,
  setReaction,
  recordReport,
  setHidden,
} from "@/lib/taste/feedback";

/**
 * Compact taste actions overlaid on an event card's image: the like/dislike
 * pair plus hide and the visually distinct report flag (like-dislike.md).
 * The card is one big <Link>, so every button swallows the click.
 */
export function EventCardActions({ event }: { event: NDKEvent }) {
  const taste = useEventTaste(eventCoordinate(event));
  const liked = taste?.clicked_like != null;
  const disliked = taste?.clicked_dislike != null;
  const reported = taste?.clicked_report != null;

  function handle(e: MouseEvent, action: () => void) {
    e.preventDefault();
    e.stopPropagation();
    action();
  }

  const buttonClass = (active: boolean) =>
    cn(
      "flex items-center justify-center w-8 h-8 rounded-full shadow-md",
      "bg-surface/80 backdrop-blur-md transition-colors active:scale-95",
      active ? "text-error" : "text-primary hover:bg-surface"
    );

  return (
    <div className="absolute top-2 right-2 flex gap-1.5">
      <button
        type="button"
        aria-label={liked ? "Remove like" : "Like event"}
        aria-pressed={liked}
        onClick={(e) => handle(e, () => void setReaction(event, liked ? null : "like"))}
        className={buttonClass(liked)}
      >
        <Heart size={15} fill={liked ? "currentColor" : "none"} />
      </button>

      <button
        type="button"
        aria-label={disliked ? "Remove dislike" : "Dislike event"}
        aria-pressed={disliked}
        onClick={(e) => handle(e, () => void setReaction(event, disliked ? null : "dislike"))}
        className={buttonClass(disliked)}
      >
        <ThumbsDown size={15} fill={disliked ? "currentColor" : "none"} />
      </button>

      <button
        type="button"
        aria-label="Hide event"
        onClick={(e) => handle(e, () => void setHidden(event, true))}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full shadow-md",
          "bg-surface/80 backdrop-blur-md transition-colors active:scale-95",
          "text-on-surface-variant hover:bg-surface"
        )}
      >
        <EyeOff size={15} />
      </button>

      <button
        type="button"
        aria-label="Report event as spam"
        onClick={(e) =>
          handle(e, () => {
            if (reported) return;
            if (!window.confirm("Report this event as spam? This cannot be undone.")) return;
            void recordReport(event);
          })
        }
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full shadow-md",
          "backdrop-blur-md transition-colors active:scale-95",
          "bg-surface/80 text-on-surface-variant hover:bg-error-container hover:text-error"
        )}
      >
        <Flag size={15} />
      </button>
    </div>
  );
}
