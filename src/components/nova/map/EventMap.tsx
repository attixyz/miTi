"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import { Clock, MapPin, ArrowRight } from "lucide-react";
import dayjs from "dayjs";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { MapEvent } from "./useNovaMapEvents";
import {
  useFilters,
  type FilterLocation,
  type MapView,
} from "@/providers/FiltersContext";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { getEventStart } from "@/components/nova/events/useNovaEvents";
import { useTheme } from "@/hooks/useTheme";
import { MAP_THEME } from "./mapTheme";

function eventHref(event: NDKEvent): string {
  try {
    const dTag = event.tags.find((t) => t[0] === "d")?.[1] || "";
    return `/event/${nip19.naddrEncode({
      kind: event.kind ?? 31923,
      pubkey: event.pubkey,
      identifier: dTag,
    })}`;
  } catch {
    return "#";
  }
}

function formatTime(event: NDKEvent): string {
  const meta = getEventMetadata(event);
  if (event.kind === 31922) return meta.start ?? "";
  const start = getEventStart(event);
  if (!start) return "";
  const startStr = start.format("h:mm A");
  if (!meta.end) return startStr;
  const endTs = parseInt(meta.end);
  if (isNaN(endTs)) return startStr;
  return `${startStr} – ${dayjs.unix(endTs).format("h:mm A")}`;
}

/** Fires once the leaflet map exists so the parent can drive zoom controls. */
function MapReady({ onReady }: { onReady?: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);
  return null;
}

/**
 * Persists the camera (center + zoom) to the shared in-memory store after every
 * pan/zoom — `moveend` fires for both — so navigating away and back restores
 * this exact view. `setMapView` is ref-backed, so this never re-renders.
 */
function MapViewTracker({ onChange }: { onChange: (view: MapView) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const { lat, lng } = map.getCenter();
      onChange({ center: [lat, lng], zoom: map.getZoom() });
    },
  });
  return null;
}

/**
 * Fits all of the day's pins into view once per day (keyed by `fitKey`). The
 * camera itself is restored from the persisted view (set on mount by EventMap),
 * which is what aims the map at a filter location — so this only fits when no
 * filter is active and no view was restored for the current day. A later day
 * change still refits.
 */
function MapController({
  center,
  events,
  fitKey,
  initialView,
}: {
  center: FilterLocation | null;
  events: MapEvent[];
  fitKey: string;
  initialView: MapView | null;
}) {
  const map = useMap();
  // Seed as already-fitted for the mount-time day so a restored view (from
  // navigation or a filter) isn't overridden; a later day change still refits.
  const fittedKeyRef = useRef<string | null>(initialView ? fitKey : null);

  useEffect(() => {
    if (center) return; // a filter is active → map opens at the restored camera
    if (fittedKeyRef.current === fitKey) return;
    if (events.length === 0) return;
    fittedKeyRef.current = fitKey;

    if (events.length === 1) {
      map.setView([events[0].lat, events[0].lon], 12);
      return;
    }
    const lats = events.map((e) => e.lat);
    const lons = events.map((e) => e.lon);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { padding: [60, 60], maxZoom: 13 }
    );
  }, [events, fitKey, center, map]);

  return null;
}

/**
 * The day's events as circle pins. Clicking one re-centers the map on it
 * (keeping the current zoom) and opens its popup anchored at the circle's
 * center — Leaflet otherwise anchors a path's popup at the exact click point.
 */
function EventMarkers({
  events,
  ring,
  pin,
}: {
  events: MapEvent[];
  ring: string;
  pin: string;
}) {
  const map = useMap();
  return (
    <>
      {events.map((me) => {
        const center: [number, number] = [me.lat, me.lon];
        return (
          <CircleMarker
            key={me.event.id}
            center={center}
            radius={11}
            pathOptions={{
              color: ring,
              weight: 2,
              fillColor: pin,
              fillOpacity: 1,
            }}
            eventHandlers={{
              click: () => map.panTo(center),
              // Re-anchor the popup at the circle center; autoPan is off on the
              // Popup since panTo above already centers it in view.
              popupopen: (e) => e.popup.setLatLng(center),
            }}
          >
            <Popup autoPan={false}>
              <MapPopupCard event={me.event} />
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

interface EventMapProps {
  events: MapEvent[];
  center: FilterLocation | null;
  onMapReady?: (map: LeafletMap) => void;
  /** Re-fit the view when this changes (e.g. the selected day). */
  fitKey: string;
}

export function EventMap({
  events,
  center,
  onMapReady,
  fitKey,
}: EventMapProps) {
  const { theme } = useTheme();
  const c = MAP_THEME[theme];
  const { getMapView, setMapView } = useFilters();
  // Snapshot the persisted camera once, at mount: where the user last left the
  // map, or — via FiltersContext — the active filter location. The tracker
  // below keeps writing as the user pans, so reading live would feed those
  // updates back into the initial position; this freezes it. `null` (no filter,
  // never panned) → the default world view + auto-fit, like before.
  const initialView = useRef<MapView | null>(getMapView()).current;

  return (
    <MapContainer
      center={initialView ? initialView.center : [20, 0]}
      zoom={initialView ? initialView.zoom : 2}
      minZoom={2}
      zoomControl={false}
      worldCopyJump
      className="w-full h-full bg-surface-low"
    >
      <TileLayer
        key={theme}
        url={c.tiles}
        attribution={c.attribution}
        subdomains="abcd"
        maxZoom={20}
      />

      <MapReady onReady={onMapReady} />
      <MapController
        center={center}
        events={events}
        fitKey={fitKey}
        initialView={initialView}
      />
      <MapViewTracker onChange={setMapView} />

      <EventMarkers events={events} ring={c.ring} pin={c.pin} />
    </MapContainer>
  );
}

function MapPopupCard({ event }: { event: NDKEvent }) {
  const meta = getEventMetadata(event);
  const time = formatTime(event);
  const category = meta.hashtags[0] as string | undefined;

  return (
    <div className="min-w-[200px] max-w-[240px] font-sans">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-semibold text-on-surface leading-snug line-clamp-2">
          {meta.title || "Untitled Event"}
        </h3>
        {category && (
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-secondary bg-secondary-container/30 px-1.5 py-0.5 rounded-full">
            {category}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 mb-2.5">
        {time && (
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <Clock size={13} className="text-primary flex-shrink-0" />
            <span className="text-xs">{time}</span>
          </div>
        )}
        {meta.location && (
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <MapPin size={13} className="text-primary flex-shrink-0" />
            <span className="text-xs line-clamp-1">{meta.location}</span>
          </div>
        )}
      </div>

      <Link
        href={eventHref(event)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        View details
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}
