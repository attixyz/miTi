"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Map, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { LoginButton } from "./LoginButton";

const NAV_LINKS = [
  { href: "/events",    icon: List,       label: "List" },
  { href: "/map",       icon: Map,        label: "Map" },
  { href: "/new-event", icon: PlusCircle, label: "Create" },
] as const;

export function TopBar() {
  const pathname = usePathname();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "bg-surface/80 backdrop-blur-md",
        "border-b border-outline-variant/30"
      )}
    >
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center justify-between px-[var(--margin-desktop)] py-4">
        <Link href="/events" className="text-xl font-bold text-primary tracking-tight">
          Meetstr
        </Link>

        <div className="flex items-center gap-6">
          {NAV_LINKS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/events" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-colors duration-200",
                  active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LoginButton />
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-[var(--margin-mobile)] py-3">
        <Link href="/events" className="text-lg font-bold text-primary tracking-tight">
          Meetstr
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LoginButton />
        </div>
      </div>
    </header>
  );
}
