"use client";

import { useCallback, useEffect, useState } from "react";
import { useNdk } from "nostr-hooks";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { fetchCalendarEvents } from "@/utils/nostr/nostrUtils";
import { useNovaEvent } from "@/components/nova/event/useNovaEvent";

/**
 * Loads a single calendar (kind 31924) cache-first via {@link useNovaEvent},
 * then resolves the events it references (upcoming / past) plus the "unapproved"
 * events — those that reference this calendar but aren't yet in its `a` tags.
 */
export function useNovaCalendar(identifier?: string) {
  const { ndk } = useNdk();
  const { event: calendar, status, loading, notFound } = useNovaEvent(identifier);

  const [upcoming, setUpcoming] = useState<NDKEvent[]>([]);
  const [past, setPast] = useState<NDKEvent[]>([]);
  const [unapproved, setUnapproved] = useState<NDKEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!calendar || !ndk || calendar.kind !== 31924) return;

    let cancelled = false;
    const load = async () => {
      setEventsLoading(true);
      try {
        const { upcoming: up, past: pa } = await fetchCalendarEvents(
          ndk,
          calendar
        );
        if (cancelled) return;
        setUpcoming(up);
        setPast(pa);

        // Events that reference this calendar but aren't approved (in its `a` tags).
        const dTag = calendar.tags.find((t) => t[0] === "d")?.[1];
        const coordinate = dTag
          ? `31924:${calendar.pubkey}:${dTag}`
          : null;
        if (coordinate) {
          const referencing = await ndk.fetchEvents({
            kinds: [31922 as number, 31923 as number],
            "#a": [coordinate],
          });
          const approved = new Set(
            calendar.tags.filter((t) => t[0] === "a").map((t) => t[1])
          );
          const pending = Array.from(referencing.values()).filter((ev) => {
            const d = ev.tags.find((t) => t[0] === "d")?.[1];
            const coord = d ? `${ev.kind}:${ev.pubkey}:${d}` : null;
            return coord && !approved.has(coord);
          });
          if (!cancelled) setUnapproved(pending as NDKEvent[]);
        }
      } catch (e) {
        console.error("Failed to load calendar events", e);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [calendar, ndk, reloadKey]);

  return {
    calendar,
    status,
    loading,
    notFound,
    upcoming,
    past,
    unapproved,
    eventsLoading,
    reload,
  };
}
