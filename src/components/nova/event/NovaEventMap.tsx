"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Bitcoin, Zap, Link2, Nfc, ExternalLink } from "lucide-react";
import { useLocationInfo } from "@/hooks/useLocationInfo";
import { decodeGeohash } from "@/utils/location/geohash";

interface NovaEventMapProps {
  location?: string | null;
  geohash?: string | null;
}

// Leaflet touches `window`, so the map only loads in the browser.
const EventLocationMap = dynamic(
  () => import("./EventLocationMap").then((m) => m.EventLocationMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-full animate-pulse bg-surface-high" />,
  }
);

/**
 * Progressive location card: when a geohash is present its coordinates are
 * decoded with pure math, so the map pin renders instantly — no network wait.
 * The Bitcoin payment badges (Overpass) and external map links then fill in once
 * Nominatim/Overpass resolve. Without a geohash, the pin waits on geocoding the
 * location string.
 */
export function NovaEventMap({ location, geohash }: NovaEventMapProps) {
  const { data, isLoading } = useLocationInfo(location, geohash);

  // Decode the geohash locally so the pin shows immediately, independent of the
  // enrichment query above. Falls back to the geocoded coords when there's no
  // (or an invalid) geohash.
  const geohashCoords = useMemo(() => {
    if (!geohash) return null;
    try {
      const { latitude, longitude } = decodeGeohash(geohash);
      return { latitude, longitude };
    } catch {
      return null;
    }
  }, [geohash]);

  const coords = geohashCoords ?? data?.coords;

  const pm = data?.paymentMethods;

  return (
    <div className="rounded-[var(--radius-md)] overflow-hidden border border-outline-variant/30 bg-surface-low">
      {/* Map area */}
      <div className="relative w-full h-[400px] bg-surface-high">
        {coords ? (
          <EventLocationMap lat={coords.latitude} lon={coords.longitude} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isLoading ? (
              <div className="w-full h-full animate-pulse bg-surface-high" />
            ) : (
              <span className="type-body-sm text-on-surface-variant opacity-60">
                No map available
              </span>
            )}
          </div>
        )}
      </div>

      {/* Payment badges (Overpass) */}
      {pm?.acceptsBitcoin && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          <Badge color="#F7931A" label="Bitcoin">
            <Bitcoin size={14} />
          </Badge>
          {pm.lightning && (
            <Badge color="#eab308" label="Lightning">
              <Zap size={14} />
            </Badge>
          )}
          {pm.onChain && (
            <Badge color="var(--on-surface-variant)" label="On-chain">
              <Link2 size={14} />
            </Badge>
          )}
          {pm.contactless && (
            <Badge color="#22c55e" label="Contactless">
              <Nfc size={14} />
            </Badge>
          )}
        </div>
      )}

      {/* External map links */}
      {data?.mapLinks && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3">
          {Object.entries(data.mapLinks).map(([key, href]) =>
            href ? (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 type-body-sm text-primary hover:underline capitalize"
              >
                {labelFor(key)}
                <ExternalLink size={12} />
              </a>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function labelFor(key: string): string {
  switch (key) {
    case "osm":
      return "OpenStreetMap";
    case "btcmap":
      return "BTCMap";
    case "google":
      return "Google Maps";
    case "apple":
      return "Apple Maps";
    default:
      return key;
  }
}

function Badge({
  children,
  label,
  color,
}: {
  children: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
      title={`${label} accepted`}
    >
      {children}
      {label}
    </span>
  );
}
