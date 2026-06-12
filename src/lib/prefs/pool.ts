// In-place NDK relay pool reconfiguration (user-preferences.md, "Relay
// bootstrap"): bring the live pool in line with the user's relay list without
// tearing down NDK — existing subscriptions and the Dexie cache stay put.

import type NDK from "@nostr-dev-kit/ndk";
import { NDKRelay, normalizeRelayUrl } from "@nostr-dev-kit/ndk";

/**
 * Make the pool match `relayUrls` exactly (DEFAULT_RELAYS handling is the
 * caller's job via getEffectiveRelays — an empty list never reaches here from
 * app code). Idempotent: comparing normalized URLs means re-applying the same
 * list is a no-op.
 */
export function applyRelaysToPool(ndk: NDK, relayUrls: string[]) {
  const target = new Set(relayUrls.map((url) => normalizeRelayUrl(url)));
  // Replace the explicit-URL list wholesale instead of mutating it:
  // nostr-hooks' initNdk assigns the constructor params into an immer store,
  // whose autoFreeze deep-freezes the original explicitRelayUrls array — and
  // NDK holds that exact array by reference, so addExplicitRelay's push()
  // throws. The setter builds a fresh mutable array, and assigning the full
  // target also drops removed relays (addExplicitRelay/removeRelay never
  // pruned the list).
  ndk.explicitRelayUrls = [...target];
  for (const url of target) {
    if (!ndk.pool.relays.has(url)) {
      ndk.pool.addRelay(new NDKRelay(url, undefined, ndk));
    }
  }
  for (const url of [...ndk.pool.relays.keys()]) {
    if (!target.has(url)) ndk.pool.removeRelay(url);
  }
}
