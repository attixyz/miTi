"use client";

import { Check, HelpCircle, X } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { cn } from "@/lib/utils";
import { setRsvpTaste } from "@/lib/taste/feedback";
import type { TasteRsvpState } from "@/lib/taste/feedback";
import { useNovaRsvp, type RsvpStatus } from "./useNovaRsvp";

const OPTIONS: { status: RsvpStatus; label: string; icon: typeof Check }[] = [
  { status: "accepted", label: "Going", icon: Check },
  { status: "tentative", label: "Maybe", icon: HelpCircle },
  { status: "declined", label: "Can't go", icon: X },
];

const TASTE_STATE: Record<RsvpStatus, TasteRsvpState> = {
  accepted: "yes",
  tentative: "maybe",
  declined: "no",
};

export function NovaEventRsvp({ event }: { event: NDKEvent }) {
  const { status, publishing, isLoggedIn, submit } = useNovaRsvp(event);

  async function handleSubmit(value: RsvpStatus) {
    // Taste feedback only for RSVPs that actually published; the delta engine
    // makes re-submitting the same status a no-op.
    if (await submit(value)) void setRsvpTaste(event, TASTE_STATE[value]);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="type-label-sm uppercase text-on-surface-variant">
        Will you attend?
      </span>
      <div
        role="group"
        aria-label="RSVP"
        className="grid grid-cols-3 gap-2"
      >
        {OPTIONS.map(({ status: value, label, icon: Icon }) => {
          const active = status === value;
          return (
            <button
              key={value}
              type="button"
              disabled={publishing}
              onClick={() => void handleSubmit(value)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 rounded-[var(--radius-md)]",
                "type-body-sm font-medium transition-all duration-200 active:scale-95",
                "disabled:opacity-60 disabled:pointer-events-none",
                active
                  ? "bg-primary text-on-primary shadow-[var(--shadow-card)]"
                  : "bg-surface-base text-on-surface-variant hover:bg-surface-high"
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>
      {!isLoggedIn && (
        <span className="type-body-sm text-on-surface-variant opacity-70">
          Log in to RSVP — your response is published to Nostr.
        </span>
      )}
    </div>
  );
}
