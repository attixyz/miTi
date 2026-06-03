"use client";

import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import { MAP_THEME } from "@/components/nova/map/mapTheme";
import { useTheme } from "@/hooks/useTheme";

interface EventLocationMapProps {
  lat: number;
  lon: number;
}

/**
 * Single-pin location map for the event detail page. Shares its tiles + pin
 * styling with the events map (/map) via MAP_THEME. The MapContainer is keyed
 * by theme so a light/dark switch fully reloads the leaflet instance with the
 * matching tileset (there's no camera state worth preserving here).
 */
export function EventLocationMap({ lat, lon }: EventLocationMapProps) {
  const { theme } = useTheme();
  const c = MAP_THEME[theme];

  return (
    <MapContainer
      key={theme}
      center={[lat, lon]}
      zoom={14}
      scrollWheelZoom={false}
      className="w-full h-full bg-surface-low"
    >
      <TileLayer
        url={c.tiles}
        attribution={c.attribution}
        subdomains="abcd"
        maxZoom={20}
      />
      <CircleMarker
        center={[lat, lon]}
        radius={11}
        pathOptions={{
          color: c.ring,
          weight: 2,
          fillColor: c.pin,
          fillOpacity: 1,
        }}
      />
    </MapContainer>
  );
}
