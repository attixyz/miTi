"use client";

import { useCallback, useState } from "react";
import { useNdk } from "nostr-hooks";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import dayjs from "@/utils/formatting/dayjsConfig";
import { encodeGeohash } from "@/utils/location/geohash";
import { cacheGeocode } from "@/utils/location/geocodeCache";
import { useActiveUser } from "@/hooks/useActiveUser";
import type { PickedLocation } from "./LocationSearchInput";

export interface CreateEventInput {
  title: string;
  summary: string; // → `summary` tag (short_description)
  description: string; // → event.content (canonical main text)
  start: string; // datetime-local wall-clock "YYYY-MM-DDTHH:mm"
  end: string; // datetime-local wall-clock, or ""
  timezone: string; // IANA identifier (start_tzid / end_tzid)
  location: PickedLocation | null;
  image: string | null;
  hashtags: string[];
  references: string[];
}

export class LoginRequiredError extends Error {
  constructor() {
    super("login-required");
    this.name = "LoginRequiredError";
  }
}

export function useCreateEvent() {
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

  /** Publishes a kind-31923 (time-based) calendar event. Returns its naddr. */
  const publish = useCallback(
    async (input: CreateEventInput): Promise<string> => {
      if (!ndk) throw new Error("NDK not ready");

      if (!activeUser) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nlLaunch", {}));
        }
        throw new LoginRequiredError();
      }

      if (!input.title.trim()) throw new Error("Title is required");
      if (!input.start) throw new Error("Start date/time is required");

      setPublishing(true);
      try {
        if (!(await ensureSigner())) {
          window.dispatchEvent(new CustomEvent("nlLaunch", {}));
          throw new LoginRequiredError();
        }

        // The timezone fix: interpret the picked wall-clock time *in the
        // selected timezone* rather than the browser's local zone.
        const startUnix = dayjs.tz(input.start, input.timezone).unix();
        const endUnix = input.end
          ? dayjs.tz(input.end, input.timezone).unix()
          : null;

        const identifier = crypto.randomUUID();
        const ev = new NDKEvent(ndk);
        ev.kind = 31923;
        ev.content = input.description || "";
        ev.tags = [
          ["d", identifier],
          ["title", input.title.trim()],
          ["start", String(startUnix)],
          ["start_tzid", input.timezone],
          ["end_tzid", input.timezone],
        ];

        if (input.summary.trim()) ev.tags.push(["summary", input.summary.trim()]);
        if (endUnix != null) ev.tags.push(["end", String(endUnix)]);

        if (input.location) {
          ev.tags.push(["location", input.location.label]);
          ev.tags.push([
            "g",
            encodeGeohash(input.location.lat, input.location.lon, 9),
          ]);
        }
        if (input.image) ev.tags.push(["image", input.image]);
        input.hashtags.forEach((t) => ev.tags.push(["t", t]));
        input.references.forEach((r) => ev.tags.push(["r", r]));

        await ev.sign();
        await ev.publish();

        // Pre-warm the geocode cache so Phase 5's distance filter gets a hit.
        if (input.location) {
          cacheGeocode(
            input.location.label,
            input.location.lat,
            input.location.lon
          ).catch(() => {});
        }

        return nip19.naddrEncode({
          kind: 31923,
          pubkey: ev.pubkey,
          identifier,
        });
      } finally {
        setPublishing(false);
      }
    },
    [ndk, activeUser, ensureSigner]
  );

  return { publish, publishing, isLoggedIn: Boolean(activeUser) };
}
