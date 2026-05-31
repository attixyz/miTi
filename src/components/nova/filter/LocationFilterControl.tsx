"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { useFilters } from "@/providers/FiltersContext";
import { cn } from "@/lib/utils";

/**
 * Compact read-only display of the active location filter (a Nominatim place or
 * "Near me", or "Anywhere" when unset). The whole control links to the
 * /set-location-filter page, passing the current path so Save can return here.
 * Used in the sidebar (wide) and top bar (narrow).
 */
export function LocationFilterControl({ className }: { className?: string }) {
  const pathname = usePathname();
  const { location } = useFilters();

  // Avoid a self-referencing return target when rendered on the filter page.
  const from =
    pathname && !pathname.startsWith("/set-location-filter")
      ? pathname
      : "/events";

  return (
    <Link
      href={`/set-location-filter?from=${encodeURIComponent(from)}`}
      aria-label="Set location filter"
      title="Set location filter"
      className={cn(
        "group flex items-center gap-2 rounded-full",
        "border border-outline-variant/50 bg-surface-low px-3 py-2",
        "text-sm text-on-surface transition-colors hover:bg-surface-high",
        className
      )}
    >
      <MapPin size={16} className="flex-shrink-0 text-primary" />
      <span
        className={cn(
          "flex-1 truncate text-left",
          !location && "text-on-surface-variant"
        )}
      >
        {location?.label ?? "Anywhere"}
      </span>
      <SlidersHorizontal
        size={16}
        className="flex-shrink-0 text-on-surface-variant transition-colors group-hover:text-on-surface"
      />
    </Link>
  );
}
