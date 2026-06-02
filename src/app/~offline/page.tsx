"use client";

import { WifiOff } from "lucide-react";

/**
 * Offline fallback served by the service worker when a navigation request fails
 * with no network. Cached events still render from ndk-cache-dexie elsewhere in
 * the app; this page only appears for routes that couldn't be reached at all.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-high text-on-surface-variant">
        <WifiOff size={28} />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-on-surface">You&apos;re offline</h1>
      <p className="text-sm text-on-surface-variant">
        This page isn&apos;t available without a connection. Anything you&apos;ve already viewed
        stays cached and readable — reconnect to load the rest.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 active:opacity-80"
      >
        Try again
      </button>
    </div>
  );
}
