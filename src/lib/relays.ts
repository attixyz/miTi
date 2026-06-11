// Single source of truth for the default Nostr relay set.
//
// Used by BOTH runtimes, intentionally:
//   - Client (`ClientProviders.tsx`): the initial pool, the relays used to
//     fetch the user's NIP-78 settings before reconfiguring, and the fallback
//     when they have no saved preferences.
//   - Server (`ndkClient.ts`): the static set for the metadata/OG/ICS
//     generators, which run for anonymous crawlers/calendar apps (no user).
//
// Keep this file pure data (no `window`, no `process`, no side effects) so it
// stays safe to import from a Client Component and a server route handler alike.
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://nostr.wine",
  "wss://nostr.mom",
  "wss://relay.ditto.pub/",
  "wss://relay.primal.net/",
];
