"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Map, Heart, PlusCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/events",    icon: List,       label: "List" },
  { href: "/map",       icon: Map,        label: "Map" },
  { href: "/suggested", icon: Heart,      label: "For You" },
  { href: "/new-event", icon: PlusCircle, label: "New" },
  { href: "/settings",  icon: Settings,   label: "Settings" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden",
        "flex items-center justify-around gap-1",
        "w-[90%] max-w-md px-4 py-2",
        "bg-surface/90 backdrop-blur-lg border border-outline-variant",
        "rounded-full shadow-[var(--shadow-overlay)]"
      )}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== "/events" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full",
              "transition-all duration-200 active:scale-90",
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-high"
            )}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
