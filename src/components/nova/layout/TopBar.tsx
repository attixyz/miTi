"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./MobileMenu";
import { LocationFilterControl } from "@/components/nova/filter/LocationFilterControl";

export function TopBar() {
  return (
    <header
      className={cn(
        "lg:hidden sticky top-0 z-50 w-full",
        "bg-surface/80 backdrop-blur-md",
        "border-b border-outline-variant/30"
      )}
    >
      <div className="flex items-center gap-2 px-[var(--margin-mobile)] py-3">
        <Link href="/events" className="text-lg font-bold text-primary tracking-tight">
          Meetstr
        </Link>
        <div className="flex min-w-0 flex-1 justify-center">
          <LocationFilterControl className="w-full max-w-[240px]" />
        </div>
        <MobileMenu />
      </div>
    </header>
  );
}
