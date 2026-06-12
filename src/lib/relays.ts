// Single source of truth for the default Nostr relay set.
//
// Used by BOTH runtimes, intentionally:
//   - Client: the initial pool and the fallback when the user has no saved
//     relay list (`prefs/settingsStore.ts`), and part of the union the NIP-78
//     settings docs are always fetched from and published to — what lets a
//     fresh device discover the settings at all (`prefs/settingsSync.ts`).
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
