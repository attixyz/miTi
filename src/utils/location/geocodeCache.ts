// Persistent geocoding cache (Phase 4, item #4).
//
// Replaces the hardcoded ~30-city DACH dictionary in locationUtils.ts: instead
// of a fixed lookup table, arbitrary location strings are geocoded via Nominatim
// and cached in IndexedDB (Dexie, directly — not through NDK), keyed by the
// normalised location string with a 30-day TTL. Phase 5's radius filter reads
// from here; the create form pre-warms it whenever a location is picked.

import Dexie, { type Table } from "dexie";

export interface GeocodeRecord {
  key: string; // normalised location string (primary key)
  found: boolean; // false = Nominatim returned nothing (negative cache)
  lat: number | null;
  lon: number | null;
  displayName: string | null;
  cachedAt: number; // epoch ms
}

export interface Coordinates {
  lat: number;
  lon: number;
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NOMINATIM_MIN_INTERVAL_MS = 1000; // Nominatim usage policy: ≤ 1 req/sec

class GeoCacheDB extends Dexie {
  geocodes!: Table<GeocodeRecord, string>;

  constructor() {
    super("miti-geo");
    this.version(1).stores({ geocodes: "key" });
  }
}

let db: GeoCacheDB | null = null;

/** Lazily open the DB; returns null in non-browser contexts (SSR). */
function getDb(): GeoCacheDB | null {
  if (typeof indexedDB === "undefined") return null;
  if (!db) db = new GeoCacheDB();
  return db;
}

export function normalizeLocationKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

// Serialise Nominatim calls so we never exceed ~1 request/second.
let lastRequest = 0;
let chain: Promise<unknown> = Promise.resolve();

function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastRequest);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequest = Date.now();
    return fn();
  };
  const result = chain.then(run, run);
  // Keep the chain alive regardless of individual failures.
  chain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function queryNominatim(query: string): Promise<GeocodeRecord> {
  const key = normalizeLocationKey(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const results = await res.json();
    const top = results?.[0];
    if (!top) {
      return { key, found: false, lat: null, lon: null, displayName: null, cachedAt: Date.now() };
    }
    return {
      key,
      found: true,
      lat: parseFloat(top.lat),
      lon: parseFloat(top.lon),
      displayName: top.display_name ?? null,
      cachedAt: Date.now(),
    };
  } catch (err) {
    console.error("Geocode lookup failed:", err);
    return { key, found: false, lat: null, lon: null, displayName: null, cachedAt: Date.now() };
  }
}

/**
 * Resolve a location string to coordinates, using the IndexedDB cache first and
 * falling back to a rate-limited Nominatim lookup. Returns null when the string
 * can't be geocoded.
 */
export async function geocodeLocation(query: string): Promise<Coordinates | null> {
  const key = normalizeLocationKey(query);
  if (!key) return null;

  const database = getDb();

  if (database) {
    const cached = await database.geocodes.get(key).catch(() => undefined);
    if (cached && Date.now() - cached.cachedAt < TTL_MS) {
      return cached.found && cached.lat != null && cached.lon != null
        ? { lat: cached.lat, lon: cached.lon }
        : null;
    }
  }

  const record = await rateLimited(() => queryNominatim(query));
  if (database) await database.geocodes.put(record).catch(() => {});

  return record.found && record.lat != null && record.lon != null
    ? { lat: record.lat, lon: record.lon }
    : null;
}

/**
 * Pre-warm the cache with a known coordinate (e.g. a location the user just
 * picked in the create form, where Nominatim already returned the coords).
 */
export async function cacheGeocode(
  query: string,
  lat: number,
  lon: number,
  displayName?: string
): Promise<void> {
  const database = getDb();
  if (!database) return;
  const key = normalizeLocationKey(query);
  if (!key) return;
  await database.geocodes
    .put({
      key,
      found: true,
      lat,
      lon,
      displayName: displayName ?? null,
      cachedAt: Date.now(),
    })
    .catch(() => {});
}
