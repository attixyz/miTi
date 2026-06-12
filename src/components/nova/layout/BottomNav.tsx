"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Map, Heart, PlusCircle, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/list",      icon: Newspaper,      label: "List" },
  { href: "/map",       icon: Map,            label: "Map" },
  { href: "/favorites", icon: Heart,          label: "Favorites" },
  { href: "/new-event", icon: PlusCircle,     label: "New" },
  { href: "/more",      icon: MoreHorizontal, label: "More" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed bottom-3 left-1/2 -translate-x-1/2 z-[1200] lg:hidden",
        "flex items-center justify-center gap-2.5",
        "w-auto max-w-[calc(100%-1.5rem)] px-2 py-2",
        // Contrasting (inverse) solid bar so the nav lifts off the page:
        // dark bar in light theme, white bar in dark theme.
        "bg-[#1e1a20] dark:bg-white",
        "border border-white/10 dark:border-black/5",
        "rounded-full shadow-[var(--shadow-overlay)]"
      )}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== "/list" && pathname.startsWith(href));
        return (
          <Link
            key={label}
            href={href}
            aria-label={label}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5",
              "transition-all duration-200 active:scale-90",
              active
                ? "w-12 h-12 rounded-full bg-[#7c2db1] text-white shadow-lg"
                : "w-12 h-12 rounded-lg text-[#d0c2d1] hover:bg-white/5 dark:text-[#4d4352] dark:hover:bg-black/5"
            )}
          >
            <Icon size={active ? 22 : 20} strokeWidth={active ? 2.5 : 1.75} />
            <span className="text-[10px] leading-tight font-semibold tracking-wide">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
