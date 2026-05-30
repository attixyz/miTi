"use client";

import { useEffect, useMemo, useState } from "react";
import { useNdk } from "nostr-hooks";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { getEventMetadata } from "@/utils/nostr/eventUtils";

/** Number of events referenced by a calendar (its `a` tags). */
export function getCalendarEventCount(calendar: NDKEvent): number {
  return calendar.tags.filter((t) => t[0] === "a").length;
}

/** `/calendar/<naddr>` link target for a kind-31924 calendar. */
export function getCalendarHref(calendar: NDKEvent): string {
  try {
    const dTag = calendar.tags.find((t) => t[0] === "d")?.[1] || "";
    const naddr = nip19.naddrEncode({
      kind: calendar.kind!,
      pubkey: calendar.pubkey,
      identifier: dTag,
    });
    return `/calendar/${naddr}`;
  } catch {
    return "#";
  }
}

function looksLikeTest(calendar: NDKEvent): boolean {
  const meta = getEventMetadata(calendar);
  const haystack = [meta.title, ...(meta.hashtags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes("test") || haystack.includes("sample");
}

/**
 * Loads kind-31924 calendars and exposes client-side search + filters.
 *
 * Event counts come from the calendar's `a`-tag count (cheap, no extra
 * fetches and no bulk pre-count pass).
 */
export function useNovaCalendars() {
  const { ndk } = useNdk();
  const [calendars, setCalendars] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [hideTest, setHideTest] = useState(true);

  useEffect(() => {
    if (!ndk) return;

    const load = async () => {
      setLoading(true);
      try {
        const results = await ndk.fetchEvents({
          kinds: [31924 as number],
          limit: 500,
        });
        const list = (Array.from(results.values()) as NDKEvent[]).sort(
          (a, b) => getCalendarEventCount(b) - getCalendarEventCount(a)
        );
        setCalendars(list);
      } catch (e) {
        console.error("Failed to load calendars", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ndk]);

  const filtered = useMemo(() => {
    let list = calendars;

    if (hideEmpty) {
      list = list.filter((c) => getCalendarEventCount(c) > 0);
    }
    if (hideTest) {
      list = list.filter((c) => !looksLikeTest(c));
    }
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((c) => {
        const meta = getEventMetadata(c);
        return [meta.title, meta.summary]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    }
    return list.slice(0, 48);
  }, [calendars, search, hideEmpty, hideTest]);

  return {
    loading,
    calendars: filtered,
    totalCount: calendars.length,
    search,
    setSearch,
    hideEmpty,
    setHideEmpty,
    hideTest,
    setHideTest,
  };
}
