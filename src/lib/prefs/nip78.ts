// NIP-78 (kind 30078, Arbitrary Custom App Data) plumbing + NIP-44
// encrypt-to-self (user-preferences.md, "Event shape" / "Encryption").
//
// Encryption goes through the nostr-login-injected `window.nostr.nip44` so it
// works identically for a NIP-07 extension, a NIP-46 bunker, and a local key.
// NIP-04 was rejected by the spec: deprecated and cryptographically weaker.
// Kind 30078 is addressable — relays keep only the newest event per
// (pubkey, kind, d), so publishing is overwrite, never append.

import type NDK from "@nostr-dev-kit/ndk";
import {
  NDKEvent,
  NDKRelaySet,
  NDKSubscriptionCacheUsage,
  type NDKFilter,
} from "@nostr-dev-kit/ndk";

export const APP_DATA_KIND = 30078;

/** True when the active signer can do NIP-44 (read-only sessions can't). */
export function nip44Available(): boolean {
  return typeof window !== "undefined" && Boolean(window.nostr?.nip44);
}

export async function encryptToSelf(pubkey: string, plaintext: string): Promise<string> {
  const nip44 = typeof window !== "undefined" ? window.nostr?.nip44 : undefined;
  if (!nip44) throw new Error("NIP-44 encryption unavailable");
  return nip44.encrypt(pubkey, plaintext);
}

export async function decryptFromSelf(pubkey: string, ciphertext: string): Promise<string> {
  const nip44 = typeof window !== "undefined" ? window.nostr?.nip44 : undefined;
  if (!nip44) throw new Error("NIP-44 decryption unavailable");
  return nip44.decrypt(pubkey, ciphertext);
}

/**
 * Newest kind-30078 event for (author, d) across the given relays. Bypasses
 * the NDK cache on purpose: the localStorage store is this device's working
 * copy, so the only thing worth fetching is what OTHER devices published.
 */
export async function fetchLatestAppData(
  ndk: NDK,
  pubkey: string,
  dTag: string,
  relayUrls: string[]
): Promise<NDKEvent | null> {
  const filter: NDKFilter = {
    kinds: [APP_DATA_KIND as number],
    authors: [pubkey],
    "#d": [dTag],
  };
  const relaySet = NDKRelaySet.fromRelayUrls(relayUrls, ndk);
  const events = await ndk.fetchEvents(
    filter,
    { closeOnEose: true, cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY },
    relaySet
  );
  let newest: NDKEvent | null = null;
  for (const event of events) {
    if (!newest || (event.created_at ?? 0) > (newest.created_at ?? 0)) newest = event;
  }
  return newest;
}

/**
 * Publish one app-data doc (already encrypted) to the given relays — always
 * the union of the user's relays and DEFAULT_RELAYS, so a fresh device can
 * discover the settings from the defaults alone. Returns the event id, which
 * the caller remembers to skip its own echo on the live subscription.
 */
export async function publishAppData(
  ndk: NDK,
  dTag: string,
  ciphertext: string,
  relayUrls: string[]
): Promise<string> {
  const event = new NDKEvent(ndk);
  event.kind = APP_DATA_KIND;
  event.tags = [["d", dTag]];
  event.content = ciphertext;
  await event.sign();
  const relaySet = NDKRelaySet.fromRelayUrls(relayUrls, ndk);
  await event.publish(relaySet);
  return event.id;
}
