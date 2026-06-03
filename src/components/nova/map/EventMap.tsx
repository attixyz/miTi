"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import { Clock, MapPin, ArrowRight } from "lucide-react";
import dayjs from "dayjs";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { MapEvent } from "./useNovaMapEvents";
import type { FilterLocation } from "@/providers/FiltersContext";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { getEventStart } from "@/components/nova/events/useNovaEvents";
import { useTheme } from "@/hooks/useTheme";

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const STADIA_ATTRIBUTION =
  '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const THEME = {
  light: {
    tiles: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    pin: "#7c2db1",
    ring: "#fbf8ff",
    radius: "#7c2db1",
    user: "#00677f",
  },
  dark: {
    tiles: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    attribution: STADIA_ATTRIBUTION,
    pin: "#e9b3ff",
    ring: "#1e1a20",
    radius: "#e9b3ff",
    user: "#4cd6ff",
  },
} as const;

/** Zoom used when the map centers on the filter location. */
const FILTER_ZOOM = 14;

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
 * Centers on the filter location (zoom 11) whenever it's set; otherwise fits all
 * of the day's pins into view once per day (keyed by `fitKey`).
 */
function MapController({
  center,
  events,
  fitKey,
}: {
  center: FilterLocation | null;
  events: MapEvent[];
  fitKey: string;
}) {
  const map = useMap();
  const fittedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!center) return;
    map.flyTo([center.lat, center.lon], FILTER_ZOOM, { duration: 0.8 });
  }, [center, map]);

  useEffect(() => {
    if (center) return; // filter-driven center wins
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
  const c = THEME[theme];

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
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
      <MapController center={center} events={events} fitKey={fitKey} />

      {events.map((me) => (
        <CircleMarker
          key={me.event.id}
          center={[me.lat, me.lon]}
          radius={11}
          pathOptions={{
            color: c.ring,
            weight: 2,
            fillColor: c.pin,
            fillOpacity: 1,
          }}
        >
          <Popup>
            <MapPopupCard event={me.event} />
          </Popup>
        </CircleMarker>
      ))}
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
