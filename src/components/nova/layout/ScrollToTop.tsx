"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating "back to top" button for the long, infinite-scrolling feeds
 * (/list, /suggested). Appears once the page is scrolled past a threshold and
 * smooth-scrolls the window to the top. Matches the BottomNav's inverse solid
 * bar (dark in light theme, white in dark theme); sits above the mobile nav
 * pill and drops to the corner on desktop where the pill is hidden.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed right-4 bottom-24 z-[1200] lg:right-6 lg:bottom-6",
        "flex h-12 w-12 items-center justify-center rounded-full",
        "bg-[#1e1a20] text-white dark:bg-white dark:text-[#1e1a20]",
        "border border-white/10 dark:border-black/5",
        "shadow-[var(--shadow-overlay)]",
        "transition-all duration-200 active:scale-90",
        visible
          ? "opacity-100 translate-y-0"
          : "pointer-events-none translate-y-2 opacity-0"
      )}
    >
      <ArrowUp size={22} strokeWidth={2.5} />
    </button>
  );
}
