"use client";

// Resolves taste-row coordinates (`kind:pubkey:d`) back to NDK events.
// /favorites and /hidden list events the user acted on, which may fall outside
// the events store's upcoming window (e.g. a liked event that already
// happened): store events are matched first, the rest are fetched from the
// NDK cache/relays with one batched subscription.

import { useEffect, useMemo, useState } from "react";
import { useNdk } from "nostr-hooks";
import {
  type NDKEvent,
  type NDKFilter,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import { eventCoordinate } from "@/lib/taste/feedback";
import { ensureFreshEvents, useEventsStore } from "../events/eventsStore";

/** Parse `kind:pubkey:d` (the d tag itself may contain colons). */
function coordinateToFilter(coordinate: string): NDKFilter | null {
  const [kindRaw, pubkey, ...dParts] = coordinate.split(":");
  const kind = Number(kindRaw);
  if (!Number.isInteger(kind) || !pubkey) return null;
  return { kinds: [kind], authors: [pubkey], "#d": [dParts.join(":")] };
}

/**
 * coordinate → newest known event version, for the given coordinates. Fills
 * progressively: store matches are synchronous, fetched ones stream in.
 */
export function useEventsByCoordinate(
  coordinates: string[]
): ReadonlyMap<string, NDKEvent> {
  const { ndk } = useNdk();
  const { events: storeEvents } = useEventsStore();
  const [fetched, setFetched] = useState<ReadonlyMap<string, NDKEvent>>(new Map());

  useEffect(() => {
    if (ndk) ensureFreshEvents(ndk);
  }, [ndk]);

  const fromStore = useMemo(() => {
    const wanted = new Set(coordinates);
    const map = new Map<string, NDKEvent>();
    for (const event of storeEvents) {
      const coordinate = eventCoordinate(event);
      if (coordinate && wanted.has(coordinate)) map.set(coordinate, event);
    }
    return map;
  }, [storeEvents, coordinates]);

  useEffect(() => {
    if (!ndk) return;
    const filters = coordinates
      .filter((c) => !fromStore.has(c) && !fetched.has(c))
      .map(coordinateToFilter)
      .filter((f): f is NDKFilter => f != null);
    if (filters.length === 0) return;

    let sub;
    try {
      sub = ndk.subscribe(filters, {
        closeOnEose: true,
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
    } catch {
      return;
    }
    sub.on("event", (incoming: NDKEvent) => {
      const coordinate = eventCoordinate(incoming);
      if (!coordinate) return;
      setFetched((prev) => {
        const existing = prev.get(coordinate);
        if (existing && (existing.created_at ?? 0) >= (incoming.created_at ?? 0)) {
          return prev;
        }
        const next = new Map(prev);
        next.set(coordinate, incoming);
        return next;
      });
    });
    return () => sub.stop();
    // `fetched` is intentionally read but not depended on: every fetched event
    // would otherwise restart the subscription it came from.
  }, [ndk, coordinates, fromStore]);

  return useMemo(() => {
    const map = new Map(fetched);
    for (const [coordinate, event] of fromStore) map.set(coordinate, event);
    return map;
  }, [fromStore, fetched]);
}
