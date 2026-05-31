"use client";

import { useCallback, useState } from "react";
import { useNdk } from "nostr-hooks";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { useActiveUser } from "@/hooks/useActiveUser";

export class LoginRequiredError extends Error {
  constructor() {
    super("login-required");
    this.name = "LoginRequiredError";
  }
}

export interface CalendarInput {
  title: string;
  description: string; // → `summary` tag + event.content
  image: string | null;
  /** Event coordinates (`31922|31923:pubkey:d`) referenced by this calendar. */
  eventRefs: string[];
}

function naddrOf(kind: number, pubkey: string, identifier: string): string {
  return nip19.naddrEncode({ kind, pubkey, identifier });
}

/** NDK-native calendar (kind 31924) create / edit / delete / approve. */
export function useCalendarMutations() {
  const { ndk } = useNdk();
  const activeUser = useActiveUser();
  const [publishing, setPublishing] = useState(false);

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

  const requireAuth = useCallback(async () => {
    if (!ndk) throw new Error("NDK not ready");
    if (!activeUser || !(await ensureSigner())) {
      if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent("nlLaunch", { detail: "welcome" }));
      }
      throw new LoginRequiredError();
    }
  }, [ndk, activeUser, ensureSigner]);

  /** Create (or, when `existing` is passed, edit) a calendar. Returns its naddr. */
  const saveCalendar = useCallback(
    async (input: CalendarInput, existing?: NDKEvent): Promise<string> => {
      await requireAuth();
      if (!input.title.trim()) throw new Error("Title is required");

      setPublishing(true);
      try {
        const identifier =
          existing?.tags.find((t) => t[0] === "d")?.[1] || crypto.randomUUID();

        const ev = new NDKEvent(ndk!);
        ev.kind = 31924;
        ev.content = input.description || "";
        ev.tags = [
          ["d", identifier],
          ["title", input.title.trim()],
        ];
        if (input.description.trim()) {
          ev.tags.push(["summary", input.description.trim()]);
        }
        if (input.image) ev.tags.push(["image", input.image]);
        input.eventRefs.forEach((coord) => ev.tags.push(["a", coord]));

        await ev.sign();
        await ev.publish();
        return naddrOf(31924, ev.pubkey, identifier);
      } finally {
        setPublishing(false);
      }
    },
    [ndk, requireAuth]
  );

  /** Publish a NIP-09 deletion request for a calendar. */
  const deleteCalendar = useCallback(
    async (calendar: NDKEvent): Promise<void> => {
      await requireAuth();
      setPublishing(true);
      try {
        const d = calendar.tags.find((t) => t[0] === "d")?.[1] || "";
        const ev = new NDKEvent(ndk!);
        ev.kind = 5;
        ev.content = "";
        ev.tags = [["a", `31924:${calendar.pubkey}:${d}`]];
        await ev.sign();
        await ev.publish();
      } finally {
        setPublishing(false);
      }
    },
    [ndk, requireAuth]
  );

  /**
   * Append an event coordinate to a calendar's `a` tags and re-publish it
   * (used to "approve" an event onto a calendar the active user owns).
   * Returns the re-published calendar.
   */
  const approveEvent = useCallback(
    async (calendar: NDKEvent, eventCoord: string): Promise<NDKEvent> => {
      await requireAuth();
      setPublishing(true);
      try {
        const ev = new NDKEvent(ndk!);
        ev.kind = 31924;
        ev.content = calendar.content || "";
        ev.tags = [
          ...calendar.tags.filter(
            (t) => !(t[0] === "a" && t[1] === eventCoord)
          ),
          ["a", eventCoord],
        ];
        await ev.sign();
        await ev.publish();
        return ev;
      } finally {
        setPublishing(false);
      }
    },
    [ndk, requireAuth]
  );

  return {
    saveCalendar,
    deleteCalendar,
    approveEvent,
    publishing,
    isLoggedIn: Boolean(activeUser),
  };
}
