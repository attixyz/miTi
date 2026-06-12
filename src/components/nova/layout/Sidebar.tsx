"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDebugFlag } from "@/lib/taste/settings";
import { NAV_SECTIONS, isActive } from "./navSections";

/**
 * Desktop-only left rail beneath the shared top bar. Holds the navigation only —
 * the brand, location filter and account/theme/language controls live in the
 * top bar (the latter behind the shared menu), mirroring the mobile bottom nav.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { debug, ready } = useDebugFlag();
  const sections = NAV_SECTIONS.filter(
    (section) => !section.debugOnly || (ready && debug)
  );

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col lg:shrink-0",
        "lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] w-60",
        "bg-surface/80 backdrop-blur-md",
        "border-r border-outline-variant/30",
        "px-3 py-4"
      )}
    >
      <nav className="flex-1 flex flex-col gap-6 overflow-y-auto">
        {sections.map((section) => (
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
    </aside>
  );
}
