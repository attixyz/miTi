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
  Type,
  Activity,
  ListOrdered,
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
export type NavSection = {
  header: string;
  items: NavItem[];
  /** Rendered only when debug mode is on (desktop sidebar + /more). */
  debugOnly?: boolean;
};

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
      { href: "/suggested",     icon: Sparkles,    label: "Suggested",     inBottomNav: true },
      { href: "/my-feedback",   icon: Heart,       label: "My feedback" },
      { href: "/spam",          icon: ShieldAlert, label: "Spam" },
      { href: "/new-event",   icon: PlusCircle,  label: "New event",    inBottomNav: true },
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
      { href: "/settings",        icon: SlidersHorizontal, label: "Preferences" },
      { href: "/settings/relays", icon: Server,            label: "Relays" },
      { href: "/about",           icon: Info,              label: "About" },
    ],
  },
  {
    header: "Debug",
    debugOnly: true,
    items: [
      { href: "/debug/words",         icon: Type,        label: "Word corpus" },
      { href: "/debug/tanh-function", icon: Activity,    label: "tanh function" },
      { href: "/debug/suggested",     icon: ListOrdered, label: "Suggested ranking" },
    ],
  },
];

export function isActive(href: string, pathname: string): boolean {
  if (href === "#") return false;
  if (href === "/list") return pathname === "/list";
  // /settings/relays is its own nav item — don't light up Preferences for it.
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(href + "/");
}
