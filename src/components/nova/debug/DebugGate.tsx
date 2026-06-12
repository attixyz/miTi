"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useDebugFlag } from "@/lib/taste/settings";

/**
 * Wraps a /debug/* page: renders it only when the debug flag is on
 * (like-dislike.md, "UI and routes"), otherwise points at Settings.
 */
export function DebugGate({
  what,
  children,
}: {
  /** Completes "Enable it in Settings to …" on the gate screen. */
  what: string;
  children: ReactNode;
}) {
  const { debug, ready } = useDebugFlag();

  if (!ready) return null;

  if (!debug) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 text-center">
        <p className="text-sm text-on-surface-variant">
          Debug mode is off. Enable it in{" "}
          <Link href="/settings" className="font-medium text-[var(--primary)] underline">
            Settings
          </Link>{" "}
          to {what}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
