"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  Map,
  Heart,
  Sparkles,
  PlusCircle,
  ShieldAlert,
  CalendarRange,
  Server,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { LoginButton } from "./LoginButton";

type NavItem = { href: string; icon: LucideIcon; label: string };
type NavSection = { header: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    header: "Events",
    items: [
      { href: "/events",      icon: List,        label: "List" },
      { href: "/map",         icon: Map,         label: "Map" },
      { href: "#",            icon: Heart,       label: "My Favorites" },
      { href: "/suggested",   icon: Sparkles,    label: "Suggested" },
      { href: "/new-event",   icon: PlusCircle,  label: "New event" },
      { href: "#",            icon: ShieldAlert, label: "Spam" },
    ],
  },
  {
    header: "Calendars",
    items: [
      { href: "/calendars",    icon: CalendarRange, label: "Calendars" },
      { href: "/new-calendar", icon: PlusCircle,    label: "New calendar" },
    ],
  },
  {
    header: "Settings",
    items: [
      { href: "#", icon: Server, label: "Relays" },
    ],
  },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "#") return false;
  if (href === "/events") return pathname === "/events";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col lg:shrink-0",
        "lg:sticky lg:top-0 lg:h-screen w-60",
        "bg-surface/80 backdrop-blur-md",
        "border-r border-outline-variant/30",
        "px-3 py-4"
      )}
    >
      <Link
        href="/events"
        className="px-3 mb-6 text-xl font-bold text-primary tracking-tight"
      >
        Meetstr
      </Link>

      <nav className="flex-1 flex flex-col gap-6 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.header} className="flex flex-col gap-0.5">
            <h3 className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
              {section.header}
            </h3>
            {section.items.map(({ href, icon: Icon, label }) => {
              const active = isActive(href, pathname);
              return (
                <Link
                  key={`${section.header}-${label}`}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2",
                    "text-sm font-medium transition-colors duration-200",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-4 flex items-center gap-1 border-t border-outline-variant/30 pt-3">
        <ThemeToggle />
        <LoginButton />
      </div>
    </aside>
  );
}
