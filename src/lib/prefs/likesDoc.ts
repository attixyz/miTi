// Payload codec for the `miti-likes` doc (user-preferences.md, "Doc 2").
//
// What syncs: the per-event feedback rows ONLY — never the `words` corpus
// (tens of thousands of rows blow the NIP-44 cap, and two diverged raw
// like_score sums cannot be merged). Each device rebuilds the corpus locally
// and rebuilds like_score by replaying these rows. Pipeline: JSON → gzip
// (browser-native CompressionStream) → base64; NIP-44 encryption is the
// caller's job. Compressed, a few hundred rows sit far below the 64 KB cap;
// the chunking escape hatch (miti-likes-0, -1, …) is noted in the spec, not
// built.

import type { EventTasteRow } from "@/lib/taste/db";

/** One synced row: the user's explicit actions, minus the cached score fields. */
export interface LikesPayloadRow {
  /** Stamped on every row change; drives the row-level last-write-wins merge. */
  updated_at: number;
  clicked_like: number | null;
  clicked_dislike: number | null;
  clicked_report: number | null;
  clicked_hide: number | null;
  last_rsvp_state: "yes" | "maybe" | "no" | null;
  added_to_calendar: number | null;
}

export interface MitiLikesDoc {
  v: 1;
  /** Epoch seconds; informational — merging is row-level by each row's updated_at. */
  updated_at: number;
  /** Address coordinate `kind:pubkey:d` → feedback row. */
  taste: Record<string, LikesPayloadRow>;
}

/**
 * The doc to publish: every event_taste row the user actually acted on.
 * Cache-only rows (lazily computed scores, updated_at null) never sync.
 */
export function buildLikesDoc(rows: EventTasteRow[]): MitiLikesDoc {
  const taste: Record<string, LikesPayloadRow> = {};
  for (const row of rows) {
    if (row.updated_at == null) continue;
    taste[row.coordinate] = {
      updated_at: row.updated_at,
      clicked_like: row.clicked_like,
      clicked_dislike: row.clicked_dislike,
      clicked_report: row.clicked_report,
      clicked_hide: row.clicked_hide,
      last_rsvp_state: row.last_rsvp_state,
      added_to_calendar: row.added_to_calendar,
    };
  }
  return { v: 1, updated_at: Math.floor(Date.now() / 1000), taste };
}

/**
 * Payload rows back into event_taste form for the merge. The cached score
 * starts stale (the merge keeps the local one where a local row exists); a
 * row whose event this device never fetched is stored anyway — kept dormant
 * until the event shows up in the cache.
 */
export function likesRowsToEventTaste(
  taste: Record<string, LikesPayloadRow>
): EventTasteRow[] {
  return Object.entries(taste).map(([coordinate, row]) => ({
    coordinate,
    like_score: 0,
    score_calculated_at: null,
    clicked_like: row.clicked_like,
    clicked_dislike: row.clicked_dislike,
    clicked_report: row.clicked_report,
    clicked_hide: row.clicked_hide,
    last_rsvp_state: row.last_rsvp_state,
    added_to_calendar: row.added_to_calendar,
    updated_at: row.updated_at,
  }));
}

function timestampOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeRow(value: unknown): LikesPayloadRow | null {
  if (typeof value !== "object" || value == null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.updated_at !== "number" || !Number.isFinite(raw.updated_at)) return null;
  const rsvp = raw.last_rsvp_state;
  return {
    updated_at: raw.updated_at,
    clicked_like: timestampOrNull(raw.clicked_like),
    clicked_dislike: timestampOrNull(raw.clicked_dislike),
    clicked_report: timestampOrNull(raw.clicked_report),
    clicked_hide: timestampOrNull(raw.clicked_hide),
    last_rsvp_state: rsvp === "yes" || rsvp === "maybe" || rsvp === "no" ? rsvp : null,
    added_to_calendar: timestampOrNull(raw.added_to_calendar),
  };
}

/** Parse + sanity-check a decompressed payload; null on garbage, rows filtered. */
export function parseLikesDoc(json: string): MitiLikesDoc | null {
  try {
    const doc = JSON.parse(json) as Partial<MitiLikesDoc>;
    if (doc?.v !== 1 || typeof doc.taste !== "object" || doc.taste == null) return null;
    const taste: Record<string, LikesPayloadRow> = {};
    for (const [coordinate, raw] of Object.entries(doc.taste)) {
      const row = sanitizeRow(raw);
      if (row) taste[coordinate] = row;
    }
    return {
      v: 1,
      updated_at: typeof doc.updated_at === "number" ? doc.updated_at : 0,
      taste,
    };
  } catch {
    return null;
  }
}

// btoa argument size is the only limit here; build the binary string in chunks.
const BASE64_CHUNK = 0x8000;

/** gzip → base64: the NIP-44 plaintext of the likes doc. */
export async function encodeLikesPlaintext(doc: MitiLikesDoc): Promise<string> {
  const gzipped = new Blob([JSON.stringify(doc)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(gzipped).arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

/** base64 → gunzip → parsed doc; null on anything malformed. */
export async function decodeLikesPlaintext(plaintext: string): Promise<MitiLikesDoc | null> {
  try {
    const bytes = Uint8Array.from(atob(plaintext.trim()), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const json = await new Response(stream).text();
    return parseLikesDoc(json);
  } catch {
    return null;
  }
}
