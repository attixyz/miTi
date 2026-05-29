"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating hero actions: like (heart) + flag (moderation menu).
 *
 * Per Phase 3 scope, the like button is intentionally inert beyond a local
 * visual toggle — persistence/publishing is deferred. The flag menu renders the
 * spam/block/hide options; their moderation logic is also future work, so the
 * handlers are placeholders for now.
 */
export function NovaEventActions() {
  const [liked, setLiked] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // TODO(Phase 7): wire up real moderation — these are UI-only for now.
  const flagActions: { label: string; danger?: boolean }[] = [
    { label: "Mark as spam" },
    { label: "Block author" },
    { label: "Hide event", danger: true },
  ];

  return (
    <div className="absolute top-4 right-4 flex gap-2">
      <button
        type="button"
        aria-label={liked ? "Remove like" : "Like event"}
        aria-pressed={liked}
        // TODO(later): publish like (NIP-25 reaction). No-op for now.
        onClick={() => setLiked((v) => !v)}
        className={cn(
          "flex items-center justify-center w-11 h-11 rounded-full shadow-lg",
          "bg-surface/80 backdrop-blur-md transition-colors active:scale-95",
          liked ? "text-error" : "text-primary hover:bg-surface"
        )}
      >
        <Heart size={20} fill={liked ? "currentColor" : "none"} />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Flag event"
          aria-expanded={flagOpen}
          onClick={() => setFlagOpen((v) => !v)}
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-full shadow-lg",
            "bg-surface/80 backdrop-blur-md text-on-surface-variant",
            "hover:bg-error-container transition-colors active:scale-95"
          )}
        >
          <Flag size={20} />
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
            {flagActions.map(({ label, danger }, i) => (
              <button
                key={label}
                role="menuitem"
                type="button"
                onClick={() => setFlagOpen(false)}
                className={cn(
                  "text-left px-4 py-2.5 type-body-sm transition-colors",
                  danger
                    ? "text-error hover:bg-error-container/40 border-t border-outline-variant/20"
                    : "text-on-surface hover:bg-surface-base",
                  i === 0 && "rounded-t-[var(--radius-md)]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
