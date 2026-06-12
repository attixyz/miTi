"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, ThumbsDown, Flag, EyeOff, MoreHorizontal } from "lucide-react";
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
 * Compact taste actions overlaid on an event card's image (like-dislike.md):
 * only the like heart and a three-dots menu show on the cover; dislike, hide
 * and the report flag live inside the menu. The card is one big <Link>, so
 * every button swallows the click.
 */
export function EventCardActions({ event }: { event: NDKEvent }) {
  const taste = useEventTaste(eventCoordinate(event));
  const liked = taste?.clicked_like != null;
  const disliked = taste?.clicked_dislike != null;
  const reported = taste?.clicked_report != null;
  const hidden = taste?.clicked_hide != null;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // A hidden action is active → flag the three-dots so it's not silently lost.
  const menuActive = disliked || hidden || reported;

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function handle(e: MouseEvent, action: () => void) {
    e.preventDefault();
    e.stopPropagation();
    action();
  }

  return (
    <div className="absolute top-2 right-2 flex gap-1.5">
      <button
        type="button"
        aria-label={liked ? "Remove like" : "Like event"}
        aria-pressed={liked}
        onClick={(e) => handle(e, () => void setReaction(event, liked ? null : "like"))}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full shadow-md",
          "bg-surface/80 backdrop-blur-md transition-colors active:scale-95",
          liked ? "text-error" : "text-primary hover:bg-surface"
        )}
      >
        <Heart size={15} fill={liked ? "currentColor" : "none"} />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="More actions"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={(e) => handle(e, () => setMenuOpen((v) => !v))}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full shadow-md",
            "bg-surface/80 backdrop-blur-md transition-colors active:scale-95 hover:bg-surface",
            menuActive ? "text-error" : "text-on-surface-variant"
          )}
        >
          <MoreHorizontal size={15} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className={cn(
              "absolute top-full right-0 mt-1.5 w-40 z-10 py-1 flex flex-col",
              "bg-surface rounded-[var(--radius-md)] shadow-[var(--shadow-overlay)]",
              "border border-outline-variant/30"
            )}
          >
            <button
              role="menuitem"
              type="button"
              aria-pressed={disliked}
              onClick={(e) =>
                handle(e, () => {
                  setMenuOpen(false);
                  void setReaction(event, disliked ? null : "dislike");
                })
              }
              className={cn(
                "flex items-center gap-2.5 text-left px-3 py-2 type-body-sm transition-colors",
                "hover:bg-surface-base",
                disliked ? "text-error" : "text-on-surface"
              )}
            >
              <ThumbsDown size={15} className="flex-shrink-0" fill={disliked ? "currentColor" : "none"} />
              {disliked ? "Remove dislike" : "Dislike"}
            </button>

            <button
              role="menuitem"
              type="button"
              aria-pressed={hidden}
              onClick={(e) =>
                handle(e, () => {
                  setMenuOpen(false);
                  void setHidden(event, !hidden);
                })
              }
              className={cn(
                "flex items-center gap-2.5 text-left px-3 py-2 type-body-sm transition-colors",
                "border-t border-outline-variant/20 hover:bg-surface-base",
                hidden ? "text-error" : "text-on-surface"
              )}
            >
              <EyeOff size={15} className="flex-shrink-0" />
              {hidden ? "Unhide event" : "Hide event"}
            </button>

            <button
              role="menuitem"
              type="button"
              disabled={reported}
              onClick={(e) =>
                handle(e, () => {
                  setMenuOpen(false);
                  if (reported) return;
                  if (!window.confirm("Report this event as spam? This cannot be undone.")) return;
                  void recordReport(event);
                })
              }
              className={cn(
                "flex items-center gap-2.5 text-left px-3 py-2 type-body-sm transition-colors",
                "border-t border-outline-variant/20 text-error hover:bg-error-container/40",
                reported && "opacity-50 cursor-default hover:bg-transparent"
              )}
            >
              <Flag size={15} className="flex-shrink-0" fill={reported ? "currentColor" : "none"} />
              {reported ? "Reported as spam" : "Report as spam"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
