"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { AppMenu } from "./AppMenu";
import { LocationFilterControl } from "@/components/nova/filter/LocationFilterControl";

/**
 * Shared top bar across every breakpoint: brand on the left, location filter in
 * the center, account/settings menu on the right. Full width and sticky so it
 * spans above both the desktop sidebar and the main column.
 */
export function TopBar() {
  return (
    <header
      className={cn(
        "sticky top-0 z-[1200] w-full h-16",
        "bg-surface",
        "border-b border-outline-variant/30"
      )}
    >
      <div className="flex h-full items-center gap-2 px-[var(--margin-mobile)] lg:px-6">
        <Link
          href="/list"
          className="flex shrink-0 items-center gap-2 text-lg lg:text-xl font-bold text-primary tracking-tight"
        >
          <Image
            src="/android-chrome-192x192.png"
            alt="miTi"
            width={32}
            height={32}
            priority
            className="h-7 w-7 lg:h-8 lg:w-8 rounded-md"
          />
          miTi
        </Link>
        <div className="flex min-w-0 flex-1 justify-center">
          <LocationFilterControl className="w-full max-w-[240px] lg:max-w-[320px]" />
        </div>
        <AppMenu />
      </div>
    </header>
  );
}
