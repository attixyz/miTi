"use client";

// Local working copy of the synced `miti-setting` doc (user-preferences.md).
//
// localStorage is always this device's source of truth — the sync engine
// (settingsSync.ts) only mirrors it to/from a NIP-78 event, so everything here
// keeps working logged out, offline, or in a read-only session. Whole-doc
// last-write-wins by `updated_at`: a remote copy is applied only when strictly
// newer than the local stamp.
//
// The `debug` flag is owned by `@/lib/taste/settings` (its UI hooks predate
// sync); this store reads/writes it through those helpers so the flag rides
// along in the synced doc without a second storage key.

import { useEffect, useState } from "react";
import { DEFAULT_RELAYS } from "@/lib/relays";
import { getDebugFlag, setDebugFlag } from "@/lib/taste/settings";

export const DEFAULT_BLOSSOM_SERVER = "https://blossom.nostr.build";

const RELAYS_KEY = "miti-relays";
const BLOSSOM_KEY = "miti-blossom-server";
const UPDATED_AT_KEY = "miti-setting-updated-at";

/** Fired on every LOCAL edit — the sync engine debounces these into a publish. */
export const SETTINGS_EDITED_EVENT = "miti-setting-edited";
/** Fired whenever any field changes, local edit and applied remote doc alike. */
export const SETTINGS_CHANGED_EVENT = "miti-setting-changed";

/** The plaintext payload of the `miti-setting` NIP-78 event. */
export interface MitiSettingDoc {
  v: 1;
  /** Epoch seconds; drives whole-doc last-write-wins. */
  updated_at: number;
  /** Empty array means "use DEFAULT_RELAYS" — an empty pool would brick fetching. */
  relays: string[];
  blossom_server: string;
  debug: boolean;
}

export interface SettingsPatch {
  relays?: string[];
  blossom_server?: string;
  debug?: boolean;
}

/** The user's saved relay list; [] when they never customized it. */
export function getStoredRelays(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RELAYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r) => typeof r === "string") : [];
  } catch {
    return [];
  }
}

/** The relay list the pool should actually use (saved list or the defaults). */
export function getEffectiveRelays(): string[] {
  const stored = getStoredRelays();
  return stored.length ? stored : [...DEFAULT_RELAYS];
}

export function getBlossomServer(): string {
  if (typeof window === "undefined") return DEFAULT_BLOSSOM_SERVER;
  return localStorage.getItem(BLOSSOM_KEY) || DEFAULT_BLOSSOM_SERVER;
}

export function getSettingsUpdatedAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = Number(localStorage.getItem(UPDATED_AT_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function buildSettingsDoc(): MitiSettingDoc {
  return {
    v: 1,
    updated_at: getSettingsUpdatedAt(),
    relays: getStoredRelays(),
    blossom_server: getBlossomServer(),
    debug: getDebugFlag(),
  };
}

function writeFields(patch: SettingsPatch, updatedAt: number) {
  if (patch.relays !== undefined) {
    localStorage.setItem(RELAYS_KEY, JSON.stringify(patch.relays));
  }
  if (patch.blossom_server !== undefined) {
    localStorage.setItem(BLOSSOM_KEY, patch.blossom_server);
  }
  if (patch.debug !== undefined && patch.debug !== getDebugFlag()) {
    setDebugFlag(patch.debug);
  }
  localStorage.setItem(UPDATED_AT_KEY, String(updatedAt));
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT));
}

/**
 * Apply a local edit (relays page Save, debug toggle): stamp `updated_at` and
 * notify the sync engine, which debounces into one immediate-on-change publish.
 * The stamp never goes backwards even under clock skew (a remote doc from a
 * clock-ahead device must not make later local edits permanently lose LWW).
 */
export function updateSettings(patch: SettingsPatch) {
  const now = Math.max(Math.floor(Date.now() / 1000), getSettingsUpdatedAt() + 1);
  writeFields(patch, now);
  window.dispatchEvent(new CustomEvent(SETTINGS_EDITED_EVENT));
}

/** Parse + sanity-check a decrypted `miti-setting` payload; null on garbage. */
export function parseSettingsDoc(json: string): MitiSettingDoc | null {
  try {
    const doc = JSON.parse(json) as Partial<MitiSettingDoc>;
    if (doc?.v !== 1 || typeof doc.updated_at !== "number") return null;
    return {
      v: 1,
      updated_at: doc.updated_at,
      relays: Array.isArray(doc.relays)
        ? doc.relays.filter((r) => typeof r === "string")
        : [],
      blossom_server:
        typeof doc.blossom_server === "string" && doc.blossom_server
          ? doc.blossom_server
          : DEFAULT_BLOSSOM_SERVER,
      debug: Boolean(doc.debug),
    };
  } catch {
    return null;
  }
}

/**
 * Whole-doc last-write-wins: apply the remote copy only when strictly newer.
 * Returns whether anything was applied (the caller then reconfigures the
 * relay pool). Never fires SETTINGS_EDITED_EVENT — applying a remote doc must
 * not trigger a re-publish loop.
 */
export function applyRemoteSettingsDoc(doc: MitiSettingDoc): boolean {
  if (doc.updated_at <= getSettingsUpdatedAt()) return false;
  writeFields(
    { relays: doc.relays, blossom_server: doc.blossom_server, debug: doc.debug },
    doc.updated_at
  );
  return true;
}

/** Live view of `blossom_server` — re-renders when settings change or sync in. */
export function useBlossomServer(): string {
  const [server, setServer] = useState(DEFAULT_BLOSSOM_SERVER);
  useEffect(() => {
    const read = () => setServer(getBlossomServer());
    read();
    window.addEventListener(SETTINGS_CHANGED_EVENT, read);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, read);
  }, []);
  return server;
}
