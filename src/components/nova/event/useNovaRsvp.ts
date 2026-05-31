"use client";

import { useCallback, useEffect, useState } from "react";
import { useNdk } from "nostr-hooks";
import {
  NDKEvent,
  type NDKFilter,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import { useActiveUser } from "@/hooks/useActiveUser";

export type RsvpStatus = "accepted" | "tentative" | "declined";

interface RsvpTarget {
  id: string;
  kind?: number;
  pubkey: string;
  tags: string[][];
}

/** NIP-52 RSVP (kind 31925) handling for a single event, nova-native:
 *  depends only on NDK + nostr-login (no toast/i18n context). */
export function useNovaRsvp(event: RsvpTarget | null) {
  const { ndk } = useNdk();
  const activeUser = useActiveUser();
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [currentRsvp, setCurrentRsvp] = useState<NDKEvent | null>(null);
  const [publishing, setPublishing] = useState(false);

  const coordinate = useCallback(() => {
    if (!event) return null;
    const d = event.tags.find((t) => t[0] === "d")?.[1] ?? "";
    return `${event.kind}:${event.pubkey}:${d}`;
  }, [event]);

  // Load the active user's existing RSVP for this event.
  useEffect(() => {
    if (!ndk || !event?.id || !activeUser) {
      setStatus(null);
      setCurrentRsvp(null);
      return;
    }

    const coord = coordinate();
    const filters: NDKFilter[] = [
      { kinds: [31925 as number], "#e": [event.id], authors: [activeUser.pubkey] },
    ];
    if (coord) {
      filters.push({
        kinds: [31925 as number],
        "#a": [coord],
        authors: [activeUser.pubkey],
      });
    }

    const sub = ndk.subscribe(filters, {
      closeOnEose: true,
      cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
    });

    sub.on("event", (rsvp: NDKEvent) => {
      setCurrentRsvp((prev) =>
        !prev || (rsvp.created_at ?? 0) >= (prev.created_at ?? 0) ? rsvp : prev
      );
      const statusTag = rsvp.tags.find((t) => t[0] === "status")?.[1];
      if (statusTag) setStatus(statusTag as RsvpStatus);
    });

    return () => sub.stop();
  }, [ndk, event?.id, activeUser, coordinate]);

  const ensureSigner = useCallback(async () => {
    if (!ndk) return false;
    if (ndk.signer) return true;
    if (typeof window !== "undefined" && window.nostr) {
      const { NDKNip07Signer } = await import("@nostr-dev-kit/ndk");
      ndk.signer = new NDKNip07Signer();
      return true;
    }
    return false;
  }, [ndk]);

  const submit = useCallback(
    async (next: RsvpStatus) => {
      if (!ndk || !event?.id) return;

      // Not logged in → open the nostr-login modal instead of failing.
      if (!activeUser) {
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("nlLaunch", { detail: "welcome" }));
        }
        return;
      }

      setPublishing(true);
      try {
        if (!(await ensureSigner())) {
          document.dispatchEvent(new CustomEvent("nlLaunch", { detail: "welcome" }));
          return;
        }

        // Retract any previous RSVP first (NIP-09 deletion).
        if (currentRsvp) {
          const del = new NDKEvent(ndk);
          del.kind = 5;
          del.content = "RSVP updated";
          del.tags = [
            ["e", currentRsvp.id],
            ["k", "31925"],
          ];
          await del.sign();
          del.publish().catch(() => {});
        }

        const coord = coordinate() ?? "";
        const rsvp = new NDKEvent(ndk);
        rsvp.kind = 31925;
        rsvp.content = next;
        rsvp.tags = [
          ["a", coord],
          ["e", event.id],
          ["d", crypto.randomUUID()],
          ["status", next],
          ["p", event.pubkey],
        ];
        await rsvp.sign();
        await rsvp.publish();

        setCurrentRsvp(rsvp);
        setStatus(next);
      } catch (err) {
        console.error("Failed to publish RSVP", err);
      } finally {
        setPublishing(false);
      }
    },
    [ndk, event, activeUser, currentRsvp, coordinate, ensureSigner]
  );

  return {
    status,
    publishing,
    isLoggedIn: Boolean(activeUser),
    submit,
  };
}
