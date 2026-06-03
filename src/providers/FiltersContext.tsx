"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dayjs from "dayjs";

/** A point the location filter measures from / centers the map on. */
export interface FilterLocation {
  lat: number;
  lon: number;
  /** Nominatim display name, or "Near me" for browser geolocation. */
  label: string;
}

/** The /map camera: where it's centered and how far it's zoomed. */
export interface MapView {
  /** [lat, lon] */
  center: [number, number];
  zoom: number;
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
  /** Selected day ("YYYY-MM-DD"), shared by the /list and /map day switchers. */
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  /**
   * Last /map camera, kept in-memory so leaving the map (e.g. to /event/[id])
   * and returning restores the same view — and so a light/dark toggle that
   * re-tiles the map keeps its place. Ref-backed: read once when the map mounts
   * and written on every pan, so panning never re-renders the app. A fresh page
   * load resets it to `null` (the map then auto-fits, like before).
   */
  getMapView: () => MapView | null;
  setMapView: (view: MapView | null) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

const STORAGE_KEY = "miti:location-filter";
/** Zoom the /map opens at when it's aimed at a filter location. */
const FILTER_ZOOM = 14;

/** The camera a filter location implies, or `null` ("Anywhere") to fit pins. */
function cameraForLocation(loc: FilterLocation | null): MapView | null {
  return loc ? { center: [loc.lat, loc.lon], zoom: FILTER_ZOOM } : null;
}

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
 * navigation between /list, /map, etc. Persisted to localStorage so it also
 * survives a reload / new tab. Initialised to no-filter on the first render
 * (to avoid a hydration mismatch) and hydrated from storage post-mount.
 */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<LocationFilter>({
    location: null,
    radiusKm: null,
  });
  // Day selection lives here (not in the per-view hooks) so it survives
  // navigation between /list and /map. Kept in-memory only — a fresh page
  // load deliberately resets to today rather than restoring a stale date.
  const [selectedDay, setSelectedDay] = useState<string>(() =>
    dayjs().format("YYYY-MM-DD")
  );
  // Map camera. A ref, not state: only the map reads it (once, at mount), so we
  // skip the re-render that writing on every pan would otherwise cause.
  const mapViewRef = useRef<MapView | null>(null);
  const getMapView = useCallback(() => mapViewRef.current, []);
  const setMapView = useCallback((view: MapView | null) => {
    mapViewRef.current = view;
  }, []);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once, after mount.
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setFilterState(stored);
      // Seed the map camera from a persisted filter so the first /map visit of
      // a session opens at the filtered place, not the default world view.
      mapViewRef.current = cameraForLocation(stored.location);
    }
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
      setFilter: (next) => {
        setFilterState(next);
        // Picking a new place/radius (or "Anywhere") is the *only* thing that
        // re-aims the map: a fresh /map mount opens at this camera. Plain
        // navigation (event → back) leaves it untouched, so the map restores
        // wherever the user last panned to. "Anywhere" → null → re-fit pins.
        mapViewRef.current = cameraForLocation(next.location);
      },
      clearFilter: () => {
        setFilterState({ location: null, radiusKm: null });
        mapViewRef.current = null;
      },
      selectedDay,
      setSelectedDay,
      getMapView,
      setMapView,
    }),
    [filter, selectedDay, getMapView, setMapView]
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
