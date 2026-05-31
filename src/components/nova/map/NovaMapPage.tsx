"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Loader2 } from "lucide-react";
import { useNovaMapEvents } from "./useNovaMapEvents";
import { MapControls } from "./MapControls";
import { DaySwitcher } from "@/components/nova/events/DaySwitcher";
import { useFilters } from "@/providers/FiltersContext";

// Leaflet touches `window`, so the map only loads in the browser.
const EventMap = dynamic(() => import("./EventMap").then((m) => m.EventMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-surface-low animate-pulse" />,
});

export function NovaMapPage() {
  const m = useNovaMapEvents();
  const { location } = useFilters();
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The negative bottom margin cancels NovaShell's mobile `pb-28` so the map
  // fills the viewport beneath the top bar (the floating nav overlays it).
  return (
    <div className="relative -mb-28 md:mb-0 w-full overflow-hidden h-[calc(100dvh-3.25rem)] md:h-[calc(100dvh-4.25rem)]">
      <EventMap
        events={m.mapEvents}
        center={location}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMapReady={setMap}
        fitKey={m.selectedDay}
      />

      {/* Top overlay: the day switcher */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex flex-col gap-2">
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
                {m.mapEvents.length}
              </span>
              <span>on the map</span>
              {m.resolving && <Loader2 size={12} className="ml-0.5 animate-spin" />}
            </>
          )}
        </div>
      </div>

      <MapControls map={map} />
    </div>
  );
}
