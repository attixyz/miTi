// Sync engine for the `miti-setting` doc (user-preferences.md, "Sync
// triggers" / "Relay bootstrap"). Started by SettingsSyncBridge once a
// signing-capable session exists; read-only sessions never start it, so
// settings there behave as today (local only).
//
// Lifecycle per session:
//   1. Bootstrap — fetch the doc over the union of the user's relays and
//      DEFAULT_RELAYS (a fresh device only knows the defaults), apply it
//      LWW, reconfigure the pool.
//   2. Live subscription on (kind 30078, me, d=miti-setting) so edits from
//      another open device land immediately. Our own publishes echo back:
//      remembered by event id and skipped.
//   3. Local edits (SETTINGS_EDITED_EVENT) publish immediately, debounced a
//      couple of seconds so rapid edits collapse into one event.
//
// Failed publishes need nothing special: localStorage stays the working copy
// and the next edit retries. The `miti-likes` doc is Phase 5, not here.

import type NDK from "@nostr-dev-kit/ndk";
import {
  NDKEvent,
  NDKNip07Signer,
  NDKSubscriptionCacheUsage,
  type NDKSubscription,
} from "@nostr-dev-kit/ndk";
import { DEFAULT_RELAYS } from "@/lib/relays";
import {
  SETTINGS_EDITED_EVENT,
  applyRemoteSettingsDoc,
  buildSettingsDoc,
  getEffectiveRelays,
  getSettingsUpdatedAt,
  parseSettingsDoc,
} from "./settingsStore";
import {
  APP_DATA_KIND,
  decryptFromSelf,
  encryptToSelf,
  fetchLatestAppData,
  nip44Available,
  publishAppData,
} from "./nip78";
import { applyRelaysToPool } from "./pool";

export const SETTING_D_TAG = "miti-setting";
const PUSH_DEBOUNCE_MS = 2000;
/** Bootstrap fetch budget — unreachable relays must not stall the live sub. */
const BOOTSTRAP_TIMEOUT_MS = 10_000;

interface SyncState {
  ndk: NDK;
  pubkey: string;
  sub: NDKSubscription | null;
  pushTimer: ReturnType<typeof setTimeout> | null;
  /** Id of our last published miti-setting event — echo-skip on the live sub. */
  lastPublishedId: string | null;
  stopped: boolean;
  onLocalEdit: () => void;
}

let state: SyncState | null = null;

/**
 * Both docs are published to (and fetched over) the union of the user's
 * relays and DEFAULT_RELAYS, so a fresh device can discover them from the
 * defaults alone (spec: "Relay bootstrap"). Shared with the miti-likes sync.
 */
export function publishRelayUrls(): string[] {
  return [...new Set([...getEffectiveRelays(), ...DEFAULT_RELAYS])];
}

async function decryptSettingsEvent(s: SyncState, event: NDKEvent) {
  try {
    const plaintext = await decryptFromSelf(s.pubkey, event.content);
    return parseSettingsDoc(plaintext);
  } catch (err) {
    console.warn("miti-setting: failed to decrypt remote doc", err);
    return null;
  }
}

function applyAndReconfigure(s: SyncState, doc: NonNullable<ReturnType<typeof parseSettingsDoc>>) {
  if (applyRemoteSettingsDoc(doc)) {
    applyRelaysToPool(s.ndk, getEffectiveRelays());
  }
}

function schedulePush(s: SyncState) {
  if (s.pushTimer != null) clearTimeout(s.pushTimer);
  s.pushTimer = setTimeout(() => {
    s.pushTimer = null;
    void push(s);
  }, PUSH_DEBOUNCE_MS);
}

async function push(s: SyncState) {
  if (s.stopped) return;
  try {
    // The NDK instance may have been created before login completed.
    if (!s.ndk.signer && typeof window !== "undefined" && window.nostr) {
      s.ndk.signer = new NDKNip07Signer();
    }
    const plaintext = JSON.stringify(buildSettingsDoc());
    const ciphertext = await encryptToSelf(s.pubkey, plaintext);
    if (s.stopped) return;
    s.lastPublishedId = await publishAppData(
      s.ndk,
      SETTING_D_TAG,
      ciphertext,
      publishRelayUrls()
    );
  } catch (err) {
    // Offline / signer hiccup: the local store stays the working copy and the
    // next edit retries (spec: "Offline / failed publish — nothing special").
    console.warn("miti-setting: publish failed", err);
  }
}

/**
 * Start syncing for the given session. Idempotent via stopSettingsSync first;
 * the bridge restarts it whenever the NDK instance or the user changes.
 */
export function startSettingsSync(ndk: NDK, pubkey: string) {
  stopSettingsSync();
  if (!nip44Available()) return; // read-only or signer without NIP-44: sync off

  const s: SyncState = {
    ndk,
    pubkey,
    sub: null,
    pushTimer: null,
    lastPublishedId: null,
    stopped: false,
    onLocalEdit: () => schedulePush(s),
  };
  state = s;
  window.addEventListener(SETTINGS_EDITED_EVENT, s.onLocalEdit);

  void (async () => {
    // Bootstrap: defaults (∪ saved relays) → fetch → apply → reconfigure pool.
    try {
      const remote = await Promise.race([
        fetchLatestAppData(ndk, pubkey, SETTING_D_TAG, publishRelayUrls()),
        // A timeout is NOT "no doc exists" — pushing then could clobber a
        // newer doc this device merely failed to fetch, so it skips the
        // push decisions below entirely.
        new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), BOOTSTRAP_TIMEOUT_MS)
        ),
      ]);
      if (s.stopped) return;
      if (remote instanceof NDKEvent) {
        const doc = await decryptSettingsEvent(s, remote);
        if (s.stopped) return;
        if (doc) {
          applyAndReconfigure(s, doc);
          // Local copy newer (edited while logged out / offline): converge the
          // other devices toward it.
          if (doc.updated_at < getSettingsUpdatedAt()) schedulePush(s);
        }
      } else if (remote === null && getSettingsUpdatedAt() > 0) {
        // No doc on any relay, but customized locally (first login after
        // edits, or edits made while logged out).
        schedulePush(s);
      }
    } catch (err) {
      console.warn("miti-setting: bootstrap fetch failed", err);
    }
    if (s.stopped) return;

    // Live subscription — changes from another device while this tab is open.
    s.sub = ndk.subscribe(
      { kinds: [APP_DATA_KIND as number], authors: [pubkey], "#d": [SETTING_D_TAG] },
      { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY }
    );
    s.sub.on("event", async (event: NDKEvent) => {
      if (s.stopped || event.id === s.lastPublishedId) return;
      const doc = await decryptSettingsEvent(s, event);
      if (doc && !s.stopped) applyAndReconfigure(s, doc);
    });
  })();
}

export function stopSettingsSync() {
  if (!state) return;
  state.stopped = true;
  window.removeEventListener(SETTINGS_EDITED_EVENT, state.onLocalEdit);
  if (state.pushTimer != null) clearTimeout(state.pushTimer);
  state.sub?.stop();
  state = null;
}
