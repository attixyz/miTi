"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders text clamped to `clampLines`. When the text overflows, the last
 * visible line fades to transparent (mask) and a "Read more" toggle appears;
 * expanding reveals the full text with a "Read less" toggle.
 */
export function ExpandableText({
  text,
  className,
  clampLines = 4,
}: {
  text: string;
  className?: string;
  clampLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  // Measure overflow only while collapsed; once expanded we keep the last
  // known value so the "Read less" toggle stays put.
  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setOverflowing(el.scrollHeight - el.clientHeight > 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  const fade = "linear-gradient(to bottom, black 55%, transparent 100%)";
  const collapsedStyle: CSSProperties | undefined = expanded
    ? undefined
    : {
        display: "-webkit-box",
        WebkitLineClamp: clampLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        ...(overflowing
          ? { WebkitMaskImage: fade, maskImage: fade }
          : {}),
      };

  return (
    <div className="flex flex-col gap-1">
      <p ref={ref} className={className} style={collapsedStyle}>
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "self-start type-body-sm font-semibold text-primary hover:underline",
            !expanded && "-mt-1"
          )}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
