"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import { Clock, MapPin, ArrowRight } from "lucide-react";
import dayjs from "dayjs";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { MapEvent, MapCenter } from "./useNovaMapEvents";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { getEventStart } from "@/components/nova/events/useNovaEvents";
import { useTheme } from "@/hooks/useTheme";

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const THEME = {
  light: {
    tiles: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    pin: "#7c2db1",
    pinSelected: "#4e0b6d",
    ring: "#fbf8ff",
    radius: "#7c2db1",
    user: "#00677f",
  },
  dark: {
    tiles: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    pin: "#e9b3ff",
    pinSelected: "#ffffff",
    ring: "#1e1a20",
    radius: "#e9b3ff",
    user: "#4cd6ff",
  },
} as const;

/** Rough km → zoom mapping so the chosen radius roughly fills the viewport. */
function zoomForRadius(radiusKm: number): number {
  const z = Math.round(14 - Math.log2(radiusKm));
  return Math.max(3, Math.min(15, z));
}

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
 * Flies to the center when it changes and fits all pins into view once per day
 * (keyed by `fitKey`) as long as the user hasn't pinned a center themselves.
 */
function MapController({
  center,
  radiusKm,
  events,
  fitKey,
}: {
  center: MapCenter | null;
  radiusKm: number | null;
  events: MapEvent[];
  fitKey: string;
}) {
  const map = useMap();
  const fittedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!center) return;
    map.flyTo([center.lat, center.lon], radiusKm ? zoomForRadius(radiusKm) : 12, {
      duration: 0.8,
    });
  }, [center, radiusKm, map]);

  useEffect(() => {
    if (center) return; // user-driven center wins
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
  center: MapCenter | null;
  radiusKm: number | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMapReady?: (map: LeafletMap) => void;
  /** Re-fit the view when this changes (e.g. the selected day). */
  fitKey: string;
}

export function EventMap({
  events,
  center,
  radiusKm,
  selectedId,
  onSelect,
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
        attribution={CARTO_ATTRIBUTION}
        subdomains="abcd"
        maxZoom={20}
      />

      <MapReady onReady={onMapReady} />
      <MapController
        center={center}
        radiusKm={radiusKm}
        events={events}
        fitKey={fitKey}
      />

      {center && radiusKm != null && (
        <Circle
          center={[center.lat, center.lon]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: c.radius,
            weight: 1,
            fillColor: c.radius,
            fillOpacity: 0.08,
          }}
        />
      )}

      {events.map((me) => {
        const selected = me.event.id === selectedId;
        return (
          <CircleMarker
            key={me.event.id}
            center={[me.lat, me.lon]}
            radius={selected ? 10 : 7}
            pathOptions={{
              color: c.ring,
              weight: 2,
              fillColor: selected ? c.pinSelected : c.pin,
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(me.event.id) }}
          >
            <Popup>
              <MapPopupCard event={me.event} />
            </Popup>
          </CircleMarker>
        );
      })}

      {center && (
        <CircleMarker
          center={[center.lat, center.lon]}
          radius={6}
          pathOptions={{
            color: c.ring,
            weight: 2,
            fillColor: c.user,
            fillOpacity: 1,
          }}
        >
          <Tooltip>{center.label}</Tooltip>
        </CircleMarker>
      )}
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
