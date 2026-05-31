"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { LoginButton } from "./LoginButton";

export function TopBar() {
  return (
    <header
      className={cn(
        "lg:hidden sticky top-0 z-50 w-full",
        "bg-surface/80 backdrop-blur-md",
        "border-b border-outline-variant/30"
      )}
    >
      <div className="flex items-center justify-between px-[var(--margin-mobile)] py-3">
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
