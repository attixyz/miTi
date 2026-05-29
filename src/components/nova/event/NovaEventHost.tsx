"use client";

import { useMemo } from "react";
import { useProfile } from "nostr-hooks";
import { nip19 } from "nostr-tools";

export function NovaEventHost({ pubkey }: { pubkey?: string | null }) {
  const { profile } = useProfile(pubkey ? { pubkey } : undefined);

  const npub = useMemo(() => {
    if (!pubkey) return "";
    try {
      return nip19.npubEncode(pubkey);
    } catch {
      return "";
    }
  }, [pubkey]);

  if (!pubkey) return null;

  const name =
    profile?.displayName || profile?.name || (npub ? `${npub.slice(0, 12)}…` : "Unknown");
  const initial = (profile?.displayName || profile?.name || npub || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <a
      href={npub ? `https://njump.me/${npub}` : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors w-fit"
    >
      <span className="flex items-center justify-center w-6 h-6 rounded-full overflow-hidden bg-primary-container text-on-primary-container text-xs font-semibold flex-shrink-0">
        {profile?.image ? (
          <img
            src={profile.image}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          initial
        )}
      </span>
      <span className="type-body-sm">
        Hosted by <span className="font-semibold text-primary">{name}</span>
      </span>
    </a>
  );
}
