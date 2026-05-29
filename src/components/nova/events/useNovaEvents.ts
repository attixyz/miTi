"use client";

import { useState, useEffect, useMemo } from "react";
import { useNdk } from "nostr-hooks";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import dayjs from "dayjs";

export function getEventStart(event: NDKEvent): dayjs.Dayjs | null {
  const metadata = getEventMetadata(event);
  if (!metadata.start) return null;

  if (event.kind === 31922) {
    const d = dayjs(metadata.start);
    return d.isValid() ? d : null;
  }

  const ts = parseInt(metadata.start);
  if (isNaN(ts)) return null;
  return dayjs.unix(ts);
}

export function useNovaEvents() {
  const { ndk } = useNdk();
  const [allEvents, setAllEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(
    dayjs().format("YYYY-MM-DD")
  );
  const [activeTags, setActiveTags] = useState<string[]>([]);

  useEffect(() => {
    if (!ndk) return;

    const load = async () => {
      setLoading(true);
      const now = Math.floor(Date.now() / 1000);
      try {
        const results = await ndk.fetchEvents({
          kinds: [31922 as any, 31923 as any],
          since: now - 30 * 24 * 3600,
          limit: 1000,
        });

        const events = Array.from(results.values()) as NDKEvent[];
        const todayStart = dayjs().startOf("day");

        const upcoming = events
          .filter((e) => {
            const start = getEventStart(e);
            return start && !start.isBefore(todayStart);
          })
          .sort((a, b) => {
            const aStart = getEventStart(a);
            const bStart = getEventStart(b);
            if (!aStart) return 1;
            if (!bStart) return -1;
            return aStart.valueOf() - bStart.valueOf();
          });

        setAllEvents(upcoming);
      } catch (e) {
        console.error("Failed to load events", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ndk]);

  const daysWithEvents = useMemo(() => {
    const days = new Set<string>();
    allEvents.forEach((e) => {
      const start = getEventStart(e);
      if (start) days.add(start.format("YYYY-MM-DD"));
    });
    return days;
  }, [allEvents]);

  const dayEvents = useMemo(() => {
    const selected = dayjs(selectedDay);
    return allEvents.filter((e) => {
      const start = getEventStart(e);
      return start && start.isSame(selected, "day");
    });
  }, [allEvents, selectedDay]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    dayEvents.forEach((e) => {
      getEventMetadata(e).hashtags.forEach((tag: string) =>
        tags.add(tag.toLowerCase())
      );
    });
    return Array.from(tags).sort();
  }, [dayEvents]);

  const filteredEvents = useMemo(() => {
    if (activeTags.length === 0) return dayEvents;
    return dayEvents.filter((e) => {
      const eventTags = getEventMetadata(e).hashtags.map((t: string) =>
        t.toLowerCase()
      );
      return activeTags.some((tag) => eventTags.includes(tag));
    });
  }, [dayEvents, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return {
    loading,
    filteredEvents,
    availableTags,
    activeTags,
    toggleTag,
    selectedDay,
    setSelectedDay,
    daysWithEvents,
    totalCount: allEvents.length,
  };
}
