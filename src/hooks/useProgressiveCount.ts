"use client";

import { useEffect, useRef, useState } from "react";

interface ProgressiveCountOptions {
  /** Cards mounted on first paint. */
  initial?: number;
  /** Cards revealed each time the sentinel scrolls into view. */
  batch?: number;
  /** Pre-fetch distance: how far before the sentinel the next batch loads. */
  rootMargin?: string;
  /**
   * When this value changes, the window resets to `initial` — used so a new
   * filter/order (a different day, tag, sort, or location) starts fresh at the
   * top instead of inheriting a previously expanded count. A purely async
   * reorder (e.g. taste scores filling in) must NOT change this key.
   */
  resetKey?: unknown;
}

/**
 * Progressive ("infinite scroll") render count for a list of `total` items.
 * The full list is still computed/sorted upstream — this only limits how many
 * items are MOUNTED, so a long feed doesn't paint hundreds of cards (and their
 * images) at once. Render the returned `sentinelRef` element after the list
 * (only while `hasMore`); when the user scrolls it near the viewport the count
 * grows by `batch`, and re-arms until the whole list is shown.
 */
export function useProgressiveCount(
  total: number,
  options: ProgressiveCountOptions = {}
) {
  const { initial = 6, batch = 6, rootMargin = "600px", resetKey } = options;
  const [count, setCount] = useState(initial);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // A new filter/order resets the window to the top.
  useEffect(() => {
    setCount(initial);
  }, [resetKey, initial]);

  const visibleCount = Math.min(count, total);
  const hasMore = visibleCount < total;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCount((c) => Math.min(c + batch, total));
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // Re-arm after each growth so a sentinel still in view keeps filling the
    // viewport, and stop once the whole list is shown.
  }, [hasMore, total, visibleCount, batch, rootMargin]);

  return { visibleCount, sentinelRef, hasMore };
}
