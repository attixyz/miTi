import {
  Newspaper,
  Map,
  Heart,
  Sparkles,
  PlusCircle,
  ShieldAlert,
  CalendarRange,
  Server,
  SlidersHorizontal,
  Info,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  /** True when this destination is already reachable from the mobile bottom nav. */
  inBottomNav?: boolean;
  /** Not yet implemented — rendered as an inert "Soon" row on the /more screen. */
  soon?: boolean;
};
export type NavSection = { header: string; items: NavItem[] };

/**
 * Single source of truth for the app's primary navigation. Consumed by the
 * desktop `Sidebar` (renders everything) and the mobile `/more` page (renders
 * only the overflow — items not already surfaced in the bottom nav).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    header: "Events",
    items: [
      { href: "/list",        icon: Newspaper,   label: "List",         inBottomNav: true },
      { href: "/map",         icon: Map,         label: "Map",          inBottomNav: true },
      { href: "/favorites",   icon: Heart,       label: "My Favorites", inBottomNav: true },
      { href: "/suggested",   icon: Sparkles,    label: "Suggested" },
      { href: "/new-event",   icon: PlusCircle,  label: "New event",    inBottomNav: true },
      { href: "/hidden",      icon: ShieldAlert, label: "Hidden & spam" },
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
      { href: "/settings", icon: SlidersHorizontal, label: "Preferences" },
      { href: "#",         icon: Server,            label: "Relays" },
      { href: "/about",    icon: Info,              label: "About" },
    ],
  },
];

export function isActive(href: string, pathname: string): boolean {
  if (href === "#") return false;
  if (href === "/list") return pathname === "/list";
  return pathname === href || pathname.startsWith(href + "/");
}
