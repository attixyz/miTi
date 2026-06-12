"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebugFlag } from "@/lib/taste/settings";
import { NAV_SECTIONS } from "@/components/nova/layout/navSections";

/**
 * Mobile overflow screen reached from the bottom nav's "More" tab. Renders the
 * sidebar's navigation minus whatever already has a dedicated bottom-nav tab, so
 * the rail and this screen stay in sync via the shared `NAV_SECTIONS` config.
 */
export function NovaMorePage() {
  const { debug, ready } = useDebugFlag();
  const sections = NAV_SECTIONS.filter(
    (section) => !section.debugOnly || (ready && debug)
  )
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.inBottomNav),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-on-surface">More</h1>

      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.header} className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
              {section.header}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface/80 backdrop-blur-md">
              {section.items.map(({ href, icon: Icon, label, soon }, i) => {
                const placeholder = href === "#" || Boolean(soon);
                const rowClass = cn(
                  "flex items-center gap-3 px-3 py-3",
                  i > 0 && "border-t border-outline-variant/20",
                  placeholder
                    ? "cursor-default opacity-60"
                    : "transition-colors duration-200 hover:bg-surface-high active:bg-surface-high"
                );
                const inner = (
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-high text-on-surface-variant">
                      <Icon size={20} />
                    </span>
                    <span className="flex-1 text-sm font-medium text-on-surface">{label}</span>
                    {placeholder ? (
                      <span className="rounded-full bg-surface-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/70">
                        Soon
                      </span>
                    ) : (
                      <ChevronRight size={18} className="text-on-surface-variant/50" />
                    )}
                  </>
                );

                return placeholder ? (
                  <div key={label} className={rowClass} aria-disabled="true">
                    {inner}
                  </div>
                ) : (
                  <Link key={label} href={href} className={rowClass}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
