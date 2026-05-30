"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Loader2 } from "lucide-react";
import { useNovaMapEvents } from "./useNovaMapEvents";
import { RadiusFilter } from "./RadiusFilter";
import { MapControls } from "./MapControls";
import { DaySwitcher } from "@/components/nova/events/DaySwitcher";
import { LocationSearchInput } from "@/components/nova/create/LocationSearchInput";

// Leaflet touches `window`, so the map only loads in the browser.
const EventMap = dynamic(() => import("./EventMap").then((m) => m.EventMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-surface-low animate-pulse" />,
});

export function NovaMapPage() {
  const m = useNovaMapEvents();
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The negative bottom margin cancels NovaShell's mobile `pb-28` so the map
  // fills the viewport beneath the top bar (the floating nav overlays it).
  return (
    <div className="relative -mb-28 md:mb-0 w-full overflow-hidden h-[calc(100dvh-3.25rem)] md:h-[calc(100dvh-4.25rem)]">
      <EventMap
        events={m.visibleEvents}
        center={m.center}
        radiusKm={m.radiusKm}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMapReady={setMap}
        fitKey={m.selectedDay}
      />

      {/* Top overlay: location + radius filters and the day switcher */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex flex-col gap-2">
        <div className="p-3 md:p-4">
          <div className="pointer-events-auto flex w-full flex-col gap-3 rounded-[var(--radius-lg)] border border-outline-variant/40 bg-surface/85 p-3 shadow-[var(--shadow-overlay)] backdrop-blur-md md:max-w-sm">
            <LocationSearchInput
              value={
                m.center
                  ? { label: m.center.label, lat: m.center.lat, lon: m.center.lon }
                  : null
              }
              onChange={m.setCenterFromPicked}
            />
            <RadiusFilter
              radiusKm={m.radiusKm}
              onChange={m.setRadiusKm}
              hasCenter={!!m.center}
            />
          </div>
        </div>

        <div className="pointer-events-auto border-y border-outline-variant/30 bg-surface/70 py-1.5 backdrop-blur-md">
          <DaySwitcher
            selectedDay={m.selectedDay}
            daysWithEvents={m.daysWithEvents}
            onSelect={m.setSelectedDay}
          />
        </div>
      </div>

      {/* Status pill (bottom-left) */}
      <div className="pointer-events-none absolute bottom-28 left-3 z-[1100] md:bottom-6 md:left-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface/85 px-3 py-1.5 text-xs text-on-surface-variant shadow-[var(--shadow-card)] backdrop-blur-md">
          {m.loading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Loading events…
            </>
          ) : (
            <>
              <span className="font-semibold text-on-surface">
                {m.visibleEvents.length}
              </span>
              <span>on the map</span>
              {m.resolving && <Loader2 size={12} className="ml-0.5 animate-spin" />}
            </>
          )}
        </div>
      </div>

      {/* Geolocation error */}
      {m.geoError && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-[1100] -translate-x-1/2 md:bottom-6">
          <div className="rounded-full bg-error px-4 py-2 text-xs font-medium text-on-error shadow-[var(--shadow-overlay)]">
            {m.geoError}
          </div>
        </div>
      )}

      <MapControls map={map} onLocate={m.locate} locating={m.geoLoading} />
    </div>
  );
}
