"use client";

// The writer of the `miti-setting` doc (user-preferences.md, "UI —
// /settings/relays"): relay list + cover-image server. Edits are staged in
// component state; Save validates, applies to this device (localStorage +
// live relay pool), and lets the sync engine publish. Works logged out too —
// the local store is always the working copy, sync just doesn't run.

import { useEffect, useState, type KeyboardEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useNdk } from "nostr-hooks";
import { cn } from "@/lib/utils";
import {
  DEFAULT_BLOSSOM_SERVER,
  getBlossomServer,
  getEffectiveRelays,
  updateSettings,
} from "@/lib/prefs/settingsStore";
import { applyRelaysToPool } from "@/lib/prefs/pool";

function isValidRelayUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "wss:";
  } catch {
    return false;
  }
}

function isValidServerUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function NovaRelaysPage() {
  const { ndk } = useNdk();
  const [ready, setReady] = useState(false);
  const [relays, setRelays] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [blossom, setBlossom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Read after mount: localStorage-backed values would mismatch the SSR HTML.
  useEffect(() => {
    setRelays(getEffectiveRelays());
    setBlossom(getBlossomServer());
    setReady(true);
  }, []);

  function addRelay() {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    if (!isValidRelayUrl(value)) {
      setError("Relay addresses must be wss:// URLs.");
      return;
    }
    setError(null);
    if (!relays.includes(value)) setRelays([...relays, value]);
    setDraft("");
  }

  function handleDraftKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addRelay();
    }
  }

  function save() {
    const server = blossom.trim() || DEFAULT_BLOSSOM_SERVER;
    if (!isValidServerUrl(server)) {
      setError("The cover image server must be an https:// URL.");
      return;
    }
    setError(null);
    // An empty relay list is stored as-is and resolves to DEFAULT_RELAYS
    // everywhere — an empty pool would brick event fetching.
    updateSettings({ relays, blossom_server: server });
    if (ndk) applyRelaysToPool(ndk, getEffectiveRelays());
    setRelays(getEffectiveRelays());
    setBlossom(server);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!ready) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-on-surface">Relays</h1>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-2">
          <p className="px-1 text-sm text-on-surface-variant">
            miTi app queries the following relays to find events:
          </p>
          <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface/80 backdrop-blur-md">
            {relays.map((relay, i) => (
              <div
                key={relay}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-outline-variant/20"
                )}
              >
                <span className="flex-1 break-all text-sm text-on-surface">{relay}</span>
                <button
                  type="button"
                  aria-label={`Delete ${relay}`}
                  onClick={() => setRelays(relays.filter((r) => r !== relay))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {relays.length === 0 && (
              <p className="px-4 py-3 text-sm text-on-surface-variant">
                No relays — saving like this falls back to the default relay set.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 pt-2">
            <span className="type-label-sm uppercase text-on-surface-variant">Add a relay</span>
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="wss://relay.address.com"
                className="flex-1 rounded-[var(--radius-md)] border border-outline-variant/40 bg-surface-low px-3 py-2 type-body-md text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 focus:border-primary"
              />
              <button
                type="button"
                aria-label="Add relay"
                onClick={addRelay}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container/30 text-on-secondary-container transition-all active:scale-95"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Cover image server
          </h2>
          <p className="px-1 text-sm text-on-surface-variant">
            The Blossom server cover images are uploaded to.
          </p>
          <input
            value={blossom}
            onChange={(e) => setBlossom(e.target.value)}
            placeholder="https://blossom.nostr.build"
            className="w-full rounded-[var(--radius-md)] border border-outline-variant/40 bg-surface-low px-3 py-2 type-body-md text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </section>

        {error && <p className="px-1 text-sm text-error">{error}</p>}

        <button
          type="button"
          onClick={save}
          className={cn(
            "flex items-center justify-center gap-2 self-start rounded-full px-6 py-3",
            "bg-primary text-on-primary type-body-md font-medium shadow-[var(--shadow-card)]",
            "transition-all active:scale-95"
          )}
        >
          {saved ? (
            <>
              <Check size={18} /> Saved
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
