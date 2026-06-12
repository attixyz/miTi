// Sync engine for the `miti-likes` doc (user-preferences.md, "Doc 2" /
// "Merging" / "Sync triggers"). Started by SettingsSyncBridge alongside the
// settings sync once a signing-capable session exists; read-only sessions
// never start it.
//
// The taste DB is always the working copy — this engine only mirrors it.
// `words_sync_tick` runs once right after login, every SYNC_INTERVAL while
// the app is open, and when the tab goes hidden (the "clicked some likes,
// closed the tab" flush). taste_version is the dirty flag (bumped by every
// feedback click); sync_meta.likes_last_pushed_version is the gate. Every
// publish is preceded by a fetch-merge so it never stomps another device:
// row-level last-write-wins on updated_at, then the worker rebuilds
// words.like_score by replaying the merged rows.
//
// Offline / failed publish: nothing special — the dirty flag stays set and
// the next tick retries.

import type NDK from "@nostr-dev-kit/ndk";
import {
  NDKEvent,
  NDKNip07Signer,
  NDKSubscriptionCacheUsage,
  type NDKSubscription,
} from "@nostr-dev-kit/ndk";
import {
  getTasteDb,
  getMetaNumber,
  getSyncMetaNumber,
  getSyncMetaString,
  setSyncMeta,
  invalidateEventScores,
  META_KEYS,
  SYNC_META_KEYS,
} from "@/lib/taste/db";
import { mergeRemoteTasteRows } from "@/lib/taste/feedback";
import { requestFeedbackReplay } from "@/lib/taste/indexer";
import {
  APP_DATA_KIND,
  decryptFromSelf,
  encryptToSelf,
  fetchLatestAppData,
  nip44Available,
  publishAppData,
} from "./nip78";
import { publishRelayUrls } from "./settingsSync";
import {
  buildLikesDoc,
  decodeLikesPlaintext,
  encodeLikesPlaintext,
  likesRowsToEventTaste,
} from "./likesDoc";

export const LIKES_D_TAG = "miti-likes";
/** Spec default: 1 h while a tab is open (implementation-plan tunables). */
const SYNC_INTERVAL_MS = 60 * 60 * 1000;
/** Fetch budget per tick — unreachable relays must not wedge the engine. */
const FETCH_TIMEOUT_MS = 10_000;
/** NIP-44 plaintext cap; the chunking escape hatch is noted, not built. */
const NIP44_MAX_PLAINTEXT = 65_535;

interface LikesSyncState {
  ndk: NDK;
  pubkey: string;
  sub: NDKSubscription | null;
  timer: ReturnType<typeof setInterval> | null;
  /** Id of our last published miti-likes event — echo-skip (persisted too). */
  lastPublishedId: string | null;
  stopped: boolean;
  onVisibility: () => void;
}

let state: LikesSyncState | null = null;

// Ticks and live-sub merges read-modify-write the same rows and sync_meta —
// serialize them (same pattern as the feedback op chain).
let chain: Promise<void> = Promise.resolve();

function enqueue(op: () => Promise<void>): Promise<void> {
  const result = chain.then(op, op);
  chain = result.catch(() => {});
  return result;
}

/**
 * Decrypt, decompress and merge one remote doc. Skips docs already applied
 * (by created_at). After a changed merge: bump taste_version (also keeps the
 * dirty flag set so a failed follow-up publish retries) and have the worker
 * rebuild words.like_score by replay.
 */
async function mergeRemoteEvent(s: LikesSyncState, event: NDKEvent): Promise<void> {
  const db = getTasteDb();
  if (!db) return;
  const createdAt = event.created_at ?? 0;
  const appliedAt = await getSyncMetaNumber(db, SYNC_META_KEYS.likesLastAppliedAt, 0);
  if (createdAt <= appliedAt) return;

  let doc;
  try {
    const plaintext = await decryptFromSelf(s.pubkey, event.content);
    doc = await decodeLikesPlaintext(plaintext);
  } catch (err) {
    console.warn("miti-likes: failed to decrypt remote doc", err);
    return;
  }
  if (!doc || s.stopped) return;

  const changed = await mergeRemoteTasteRows(likesRowsToEventTaste(doc.taste));
  await setSyncMeta(db, SYNC_META_KEYS.likesLastAppliedAt, createdAt);
  if (changed) {
    await invalidateEventScores(db);
    await setSyncMeta(db, SYNC_META_KEYS.likesReplayPending, 1);
    requestFeedbackReplay();
  }
}

/**
 * words_sync_tick. `force` (the login trigger) skips the dirty check so the
 * remote doc is always fetched and merged once per session; publishing still
 * only happens when there is anything local to say.
 */
async function tick(s: LikesSyncState, opts: { force?: boolean } = {}): Promise<void> {
  if (s.stopped) return;
  const db = getTasteDb();
  if (!db) return;

  const version = await getMetaNumber(db, META_KEYS.tasteVersion);
  const lastPushed = await getSyncMetaNumber(
    db,
    SYNC_META_KEYS.likesLastPushedVersion,
    -1
  );
  if (!opts.force && version === lastPushed) return; // nothing changed locally

  // Always fetch-merge before publish, so another device's rows are folded in
  // instead of overwritten (kind 30078 publishes are whole-doc overwrites).
  let remote: NDKEvent | "timeout" | null;
  try {
    remote = await Promise.race([
      fetchLatestAppData(s.ndk, s.pubkey, LIKES_D_TAG, publishRelayUrls()),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), FETCH_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    console.warn("miti-likes: fetch failed", err);
    return; // dirty flag stays set; the next tick retries
  }
  if (s.stopped) return;
  // A timeout is NOT "no doc exists" — publishing then could stomp rows this
  // device merely failed to fetch.
  if (remote === "timeout") return;
  if (remote instanceof NDKEvent && remote.id !== s.lastPublishedId) {
    await mergeRemoteEvent(s, remote);
    if (s.stopped) return;
  }

  // Publish the (possibly merged) union. The version is re-read first: the
  // merge bumps it, and a click landing mid-publish must keep the dirty flag
  // set for the next tick. On a clean forced (login) tick there is nothing to
  // say — the fetch-merge above was the point.
  const versionToPush = await getMetaNumber(db, META_KEYS.tasteVersion);
  if (versionToPush === lastPushed) return;
  const rows = (await db.event_taste.toArray()).filter((r) => r.updated_at != null);
  if (rows.length === 0) {
    // Nothing the user ever did — nothing worth publishing. Mark this version
    // clean so idle ticks stop re-fetching.
    await setSyncMeta(db, SYNC_META_KEYS.likesLastPushedVersion, versionToPush);
    return;
  }

  try {
    // The NDK instance may have been created before login completed.
    if (!s.ndk.signer && typeof window !== "undefined" && window.nostr) {
      s.ndk.signer = new NDKNip07Signer();
    }
    const plaintext = await encodeLikesPlaintext(buildLikesDoc(rows));
    if (plaintext.length > NIP44_MAX_PLAINTEXT) {
      console.warn(
        "miti-likes: payload exceeds the NIP-44 cap; chunking is not built — skipping publish"
      );
      return;
    }
    const ciphertext = await encryptToSelf(s.pubkey, plaintext);
    if (s.stopped) return;
    s.lastPublishedId = await publishAppData(
      s.ndk,
      LIKES_D_TAG,
      ciphertext,
      publishRelayUrls()
    );
    await setSyncMeta(db, SYNC_META_KEYS.likesLastPublishedId, s.lastPublishedId);
    await setSyncMeta(db, SYNC_META_KEYS.likesLastPushedVersion, versionToPush);
  } catch (err) {
    console.warn("miti-likes: publish failed", err);
  }
}

/**
 * Start syncing for the given session. Idempotent via stopLikesSync first;
 * the bridge restarts it whenever the NDK instance or the user changes.
 */
export function startLikesSync(ndk: NDK, pubkey: string) {
  stopLikesSync();
  if (!nip44Available()) return; // read-only or signer without NIP-44: sync off

  const s: LikesSyncState = {
    ndk,
    pubkey,
    sub: null,
    timer: null,
    lastPublishedId: null,
    stopped: false,
    onVisibility: () => {
      // The tab-hidden flush: best-effort, covers "clicked likes, closed tab".
      if (document.visibilityState === "hidden") void enqueue(() => tick(s));
    },
  };
  state = s;
  document.addEventListener("visibilitychange", s.onVisibility);
  s.timer = setInterval(() => void enqueue(() => tick(s)), SYNC_INTERVAL_MS);

  void (async () => {
    const db = getTasteDb();
    if (db) {
      s.lastPublishedId = await getSyncMetaString(
        db,
        SYNC_META_KEYS.likesLastPublishedId
      );
      // A merge-triggered replay that was lost to a tab close last session.
      if ((await getSyncMetaNumber(db, SYNC_META_KEYS.likesReplayPending)) === 1) {
        requestFeedbackReplay();
      }
    }
    if (s.stopped) return;

    // Login trigger: fetch-merge once, publish if dirty.
    await enqueue(() => tick(s, { force: true }));
    if (s.stopped) return;

    // Live subscription — another device's push lands while this tab is open;
    // merged immediately, published (if changed) on the next tick at most an
    // hour later. Our own publishes echo back: skipped by event id.
    s.sub = s.ndk.subscribe(
      { kinds: [APP_DATA_KIND as number], authors: [pubkey], "#d": [LIKES_D_TAG] },
      { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY }
    );
    s.sub.on("event", (event: NDKEvent) => {
      if (s.stopped || event.id === s.lastPublishedId) return;
      void enqueue(() => mergeRemoteEvent(s, event));
    });
  })();
}

export function stopLikesSync() {
  if (!state) return;
  state.stopped = true;
  document.removeEventListener("visibilitychange", state.onVisibility);
  if (state.timer != null) clearInterval(state.timer);
  state.sub?.stop();
  state = null;
}
