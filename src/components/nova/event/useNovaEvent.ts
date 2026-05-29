"use client";

import { useEffect, useState } from "react";
import { useNdk } from "nostr-hooks";
import {
  type NDKEvent,
  type NDKFilter,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

type Status = "loading" | "found" | "not-found";

/** Builds an NDK filter from a naddr / note / nevent / raw hex identifier. */
function buildFilter(identifier: string): NDKFilter | null {
  try {
    if (
      identifier.startsWith("naddr") ||
      identifier.startsWith("note") ||
      identifier.startsWith("nevent")
    ) {
      const decoded = nip19.decode(identifier);
      if (decoded.type === "naddr") {
        const d = decoded.data;
        return {
          kinds: [d.kind as number],
          authors: [d.pubkey],
          "#d": [d.identifier],
        };
      }
      if (decoded.type === "note") {
        return { ids: [decoded.data as string] };
      }
      if (decoded.type === "nevent") {
        return { ids: [(decoded.data as { id: string }).id] };
      }
      return null;
    }
    // Assume a raw 64-char hex event id.
    return { ids: [identifier] };
  } catch {
    return null;
  }
}

/**
 * Fetches a single calendar event, cache-first.
 *
 * With the `ndk-cache-dexie` adapter, a cached copy is emitted from IndexedDB
 * almost immediately (letting the page render its skeleton with real fields),
 * and a fresher relay copy replaces it when it arrives.
 */
export function useNovaEvent(identifier?: string) {
  const { ndk } = useNdk();
  const [event, setEvent] = useState<NDKEvent | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!ndk || !identifier) return;

    setEvent(null);
    setStatus("loading");

    const filter = buildFilter(identifier);
    if (!filter) {
      setStatus("not-found");
      return;
    }

    let received = false;
    let sub;
    try {
      sub = ndk.subscribe(filter, {
        closeOnEose: true,
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
    } catch {
      // NDK rejects malformed filters (e.g. a non-hex raw id) synchronously.
      setStatus("not-found");
      return;
    }

    sub.on("event", (incoming: NDKEvent) => {
      received = true;
      // Replaceable events can arrive in multiple versions — keep the newest.
      setEvent((prev) =>
        !prev || (incoming.created_at ?? 0) >= (prev.created_at ?? 0)
          ? incoming
          : prev
      );
      setStatus("found");
    });

    sub.on("eose", () => {
      if (!received) setStatus("not-found");
    });

    return () => sub.stop();
  }, [ndk, identifier]);

  return { event, status, loading: status === "loading", notFound: status === "not-found" };
}
