"use client";

import { cn } from "@/lib/utils";

interface TagFilterChipsProps {
  tags: string[];
  activeTags: string[];
  onToggle: (tag: string) => void;
}

export function TagFilterChips({ tags, activeTags, onToggle }: TagFilterChipsProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none px-[var(--margin-mobile)] md:px-[var(--margin-desktop)]">
      {tags.map((tag) => {
        const active = activeTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold",
              "transition-all duration-150 capitalize",
              active
                ? "bg-primary text-on-primary"
                : "bg-surface-low text-on-surface-variant border border-outline-variant/40 hover:border-primary/40"
            )}
          >
            #{tag}
          </button>
        );
      })}
    </div>
  );
}
