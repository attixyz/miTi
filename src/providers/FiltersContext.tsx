"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** A point the location filter measures from / centers the map on. */
export interface FilterLocation {
  lat: number;
  lon: number;
  /** Nominatim display name, or "Near me" for browser geolocation. */
  label: string;
}

export interface LocationFilter {
  location: FilterLocation | null;
  /** Distance in km; `null` = "Any distance" (no radius filtering). */
  radiusKm: number | null;
}

interface FiltersContextValue extends LocationFilter {
  /** Commit both location and radius at once (used by the Save button). */
  setFilter: (next: LocationFilter) => void;
  clearFilter: () => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

const STORAGE_KEY = "meetstr:location-filter";

function readStored(): LocationFilter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocationFilter;
    // Minimal shape validation — ignore anything malformed.
    if (
      parsed &&
      (parsed.location === null ||
        (typeof parsed.location?.lat === "number" &&
          typeof parsed.location?.lon === "number" &&
          typeof parsed.location?.label === "string")) &&
      (parsed.radiusKm === null || typeof parsed.radiusKm === "number")
    ) {
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

/**
 * App-wide location filter, mounted above the route outlet so it survives
 * navigation between /events, /map, etc. Persisted to localStorage so it also
 * survives a reload / new tab. Initialised to no-filter on the first render
 * (to avoid a hydration mismatch) and hydrated from storage post-mount.
 */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<LocationFilter>({
    location: null,
    radiusKm: null,
  });
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once, after mount.
  useEffect(() => {
    const stored = readStored();
    if (stored) setFilterState(stored);
    setHydrated(true);
  }, []);

  // Persist on change (but not before we've hydrated, so the initial empty
  // state doesn't clobber stored values on first paint).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filter));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [filter, hydrated]);

  const value = useMemo<FiltersContextValue>(
    () => ({
      location: filter.location,
      radiusKm: filter.radiusKm,
      setFilter: (next) => setFilterState(next),
      clearFilter: () => setFilterState({ location: null, radiusKm: null }),
    }),
    [filter]
  );

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  );
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) {
    throw new Error("useFilters must be used within a FiltersProvider");
  }
  return ctx;
}
