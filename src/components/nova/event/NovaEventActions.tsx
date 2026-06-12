"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, ThumbsDown, Flag } from "lucide-react";
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
 * heart (like) with the thumb-down (dislike) next to it — a mutually
 * exclusive pair — and the visually distinct flag menu for the moderation
 * actions: report (one-shot) and hide (no points, removes from view).
 * Nothing is published; all feedback stays on this device.
 */
export function NovaEventActions({ event }: { event: NDKEvent }) {
  const taste = useEventTaste(eventCoordinate(event));
  const [flagOpen, setFlagOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const liked = taste?.clicked_like != null;
  const disliked = taste?.clicked_dislike != null;
  const reported = taste?.clicked_report != null;
  const hidden = taste?.clicked_hide != null;

  useEffect(() => {
    if (!flagOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFlagOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [flagOpen]);

  function handleReport() {
    setFlagOpen(false);
    if (reported) return;
    if (!window.confirm("Report this event as spam? This cannot be undone.")) return;
    void recordReport(event);
  }

  function handleHide() {
    setFlagOpen(false);
    void setHidden(event, !hidden);
  }

  return (
    <div className="absolute top-4 right-4 flex gap-2">
      <button
        type="button"
        aria-label={liked ? "Remove like" : "Like event"}
        aria-pressed={liked}
        onClick={() => void setReaction(event, liked ? null : "like")}
        className={cn(
          "flex items-center justify-center w-11 h-11 rounded-full shadow-lg",
          "bg-surface/80 backdrop-blur-md transition-colors active:scale-95",
          liked ? "text-error" : "text-primary hover:bg-surface"
        )}
      >
        <Heart size={20} fill={liked ? "currentColor" : "none"} />
      </button>

      <button
        type="button"
        aria-label={disliked ? "Remove dislike" : "Dislike event"}
        aria-pressed={disliked}
        onClick={() => void setReaction(event, disliked ? null : "dislike")}
        className={cn(
          "flex items-center justify-center w-11 h-11 rounded-full shadow-lg",
          "bg-surface/80 backdrop-blur-md transition-colors active:scale-95",
          disliked ? "text-error" : "text-primary hover:bg-surface"
        )}
      >
        <ThumbsDown size={20} fill={disliked ? "currentColor" : "none"} />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Flag event"
          aria-expanded={flagOpen}
          onClick={() => setFlagOpen((v) => !v)}
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-full shadow-lg",
            "backdrop-blur-md transition-colors active:scale-95",
            reported
              ? "bg-error-container text-error"
              : "bg-surface/80 text-on-surface-variant hover:bg-error-container"
          )}
        >
          <Flag size={20} fill={reported ? "currentColor" : "none"} />
        </button>

        {flagOpen && (
          <div
            role="menu"
            className={cn(
              "absolute top-full right-0 mt-2 w-44 z-10 py-1.5 flex flex-col",
              "bg-surface rounded-[var(--radius-md)] shadow-[var(--shadow-overlay)]",
              "border border-outline-variant/30"
            )}
          >
            <button
              role="menuitem"
              type="button"
              disabled={reported}
              onClick={handleReport}
              className={cn(
                "text-left px-4 py-2.5 type-body-sm transition-colors rounded-t-[var(--radius-md)]",
                "text-error hover:bg-error-container/40",
                reported && "opacity-50 cursor-default hover:bg-transparent"
              )}
            >
              {reported ? "Reported as spam" : "Report as spam"}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={handleHide}
              className={cn(
                "text-left px-4 py-2.5 type-body-sm transition-colors",
                "text-on-surface hover:bg-surface-base border-t border-outline-variant/20"
              )}
            >
              {hidden ? "Unhide event" : "Hide event"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
