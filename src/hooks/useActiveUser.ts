// src/hooks/useActiveUser.ts
"use client";

import { useEffect, useState } from "react";

type ActiveUser = { pubkey: string; npub: string };

// Shared across hook instances so a component mounting *after* login still sees
// the current user immediately (without re-querying the signer).
let cachedUser: ActiveUser | null = null;

/** Resolve the logged-in user from the nostr-login-injected `window.nostr`.
 *  Only called in response to an `nlAuth` event (i.e. after the user has
 *  authenticated), so it never triggers a login prompt on its own. */
async function resolveActiveUser(): Promise<ActiveUser | null> {
  if (typeof window === "undefined" || !window.nostr) return null;
  try {
    const pubkey = await window.nostr.getPublicKey();
    if (!pubkey) return null;
    const { nip19 } = await import("nostr-tools");
    return { pubkey, npub: nip19.npubEncode(pubkey) };
  } catch {
    return null;
  }
}

/**
 * Current nostr-login user (or null). NDK-native: driven entirely by the
 * `nlAuth` / `nlLogout` events nostr-login dispatches — no separate auth
 * service. nostr-login emits `nlAuth` on session restore too, so a fresh load
 * resolves the user without us probing the signer on mount.
 */
export function useActiveUser() {
  const [user, setUser] = useState<ActiveUser | null>(cachedUser);

  useEffect(() => {
    let cancelled = false;

    const onAuth = async (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type;
      if (type === "logout") {
        cachedUser = null;
        if (!cancelled) setUser(null);
        return;
      }
      const resolved = await resolveActiveUser();
      cachedUser = resolved;
      if (!cancelled) setUser(resolved);
    };

    const onLogout = () => {
      cachedUser = null;
      if (!cancelled) setUser(null);
    };

    document.addEventListener("nlAuth", onAuth);
    document.addEventListener("nlLogout", onLogout);

    // Surface an already-known user for late-mounting components.
    if (cachedUser) setUser(cachedUser);

    return () => {
      cancelled = true;
      document.removeEventListener("nlAuth", onAuth);
      document.removeEventListener("nlLogout", onLogout);
    };
  }, []);

  return user;
}
