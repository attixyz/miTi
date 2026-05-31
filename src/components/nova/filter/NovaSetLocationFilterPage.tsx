"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Crosshair, Loader2 } from "lucide-react";
import { useFilters, type FilterLocation } from "@/providers/FiltersContext";
import { LocationSearchInput } from "@/components/nova/create/LocationSearchInput";
import { RadiusFilter } from "@/components/nova/map/RadiusFilter";
import { getCurrentLocation } from "@/utils/location/locationUtils";
import { cn } from "@/lib/utils";

const DEFAULT_RADIUS_KM = 25;

/** Only navigate back to in-app paths (guards against open-redirect via ?from). */
function safeReturnTarget(from: string | null): string {
  if (from && from.startsWith("/") && !from.startsWith("//")) return from;
  return "/events";
}

export function NovaSetLocationFilterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTarget(searchParams.get("from"));

  const { location, radiusKm, setFilter } = useFilters();

  // Local draft — committed to the shared filter only on Save.
  const [draftLocation, setDraftLocation] = useState<FilterLocation | null>(
    location
  );
  const [draftRadius, setDraftRadius] = useState<number | null>(radiusKm);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Picking a location with no radius yet defaults to a sensible distance.
  function applyLocation(next: FilterLocation | null) {
    setDraftLocation(next);
    if (next && draftRadius == null) setDraftRadius(DEFAULT_RADIUS_KM);
  }

  async function useMyLocation() {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const { latitude, longitude } = await getCurrentLocation();
      applyLocation({ lat: latitude, lon: longitude, label: "Near me" });
    } catch {
      setGeoError("Couldn't access your location");
    } finally {
      setGeoLoading(false);
    }
  }

  function save() {
    setFilter({ location: draftLocation, radiusKm: draftRadius });
    router.push(returnTo);
  }

  function clear() {
    setDraftLocation(null);
  }

  return (
    <div className="mx-auto w-full max-w-lg px-[var(--margin-mobile)] py-4 md:px-[var(--margin-desktop)] md:py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="type-headline-sm font-semibold text-on-surface">
          Location filter
        </h1>
      </div>

      <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-outline-variant/40 bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
        <LocationSearchInput value={draftLocation} onChange={applyLocation} />

        {/* Crosshair: browser geolocation */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoLoading}
            className={cn(
              "flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5",
              "border border-outline-variant/40 bg-surface-low text-on-surface",
              "type-body-md font-medium transition-colors hover:bg-surface-high",
              "disabled:opacity-60"
            )}
          >
            {geoLoading ? (
              <Loader2 size={18} className="animate-spin text-primary" />
            ) : (
              <Crosshair size={18} className="text-primary" />
            )}
            Use my current location
          </button>
          {geoError && (
            <p className="text-xs font-medium text-error">{geoError}</p>
          )}
        </div>

        <RadiusFilter
          radiusKm={draftRadius}
          onChange={setDraftRadius}
          hasCenter={!!draftLocation}
        />

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={save}
            className={cn(
              "flex-1 rounded-full bg-primary px-4 py-2.5",
              "type-body-md font-semibold text-on-primary",
              "transition-colors hover:bg-primary/90 active:scale-[0.99]"
            )}
          >
            Save
          </button>
          {draftLocation && (
            <button
              type="button"
              onClick={clear}
              className="rounded-full px-4 py-2.5 type-body-md font-medium text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
