// src/utils/location/locationUtils.ts
import { decodeGeohash } from "@/utils/location/geohash";
import { fetchOsmTags } from "@/utils/location/osmTags";
import addressFormatter from "@fragaria/address-formatter";
import type { LocationData } from "@/types/location";

// In-memory cache for Nominatim responses (keyed by URL).
const nominatimCache: Record<string, unknown> = {};

/**
 * Serialises Nominatim requests so we stay within the public API's usage
 * policy (≈1 req/s). Each call waits at least `intervalMs` after the previous.
 */
class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly intervalMs: number;

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn());
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const sinceLast = Date.now() - this.lastRequestTime;
      if (sinceLast < this.intervalMs) {
        await new Promise((r) => setTimeout(r, this.intervalMs - sinceLast));
      }
      const task = this.queue.shift();
      if (task) {
        this.lastRequestTime = Date.now();
        await task();
      }
    }

    this.processing = false;
  }
}

const rateLimiter = new RateLimiter(800);

/** Fetch a URL through the in-memory cache + Nominatim rate limiter. */
async function fetchWithCache(url: string) {
  if (url in nominatimCache) return nominatimCache[url];

  const data = await rateLimiter.add(async () => {
    const response = await fetch(url, {
      headers: { "User-Agent": "miti-nostr" },
    });
    if (!response.ok) return null;
    return response.json();
  });

  if (data) nominatimCache[url] = data;
  return data;
}

/**
 * Resolves a location string (or geohash) to coordinates, OSM payment tags,
 * map links and a formatted address. Used by the event-detail map info path
 * (via the batched DataLoader in `loader.ts`).
 */
export async function getLocationInfo(
  locationName: string,
  geohash?: string
): Promise<LocationData | null> {
  try {
    let osmResult: any = null;

    if (locationName) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
      const results = await fetchWithCache(url);
      osmResult = results?.[0];
    }

    if (!osmResult && geohash) {
      const decoded = decodeGeohash(geohash);
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${decoded.latitude}&lon=${decoded.longitude}&format=json`;
      osmResult = await fetchWithCache(url);
    }

    if (!osmResult) return null;

    const osmTags = await fetchOsmTags(osmResult.osm_type, osmResult.osm_id);

    const paymentMethods = {
      acceptsBitcoin: osmTags["currency:XBT"] === "yes",
      onChain: osmTags["payment:onchain"] === "yes",
      lightning: osmTags["payment:lightning"] === "yes",
      contactless: osmTags["payment:lightning_contactless"] === "yes",
    };

    const coords = {
      latitude: parseFloat(osmResult.lat),
      longitude: parseFloat(osmResult.lon),
    };

    const mapLinks = {
      osm: `https://openstreetmap.org/${osmResult.osm_type}/${osmResult.osm_id}`,
      google: `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude},${encodeURIComponent(osmResult.display_name || "")}`,
      apple: `https://maps.apple.com/?q=${encodeURIComponent(osmResult.name || "")}&ll=${coords.latitude},${coords.longitude}`,
      ...(paymentMethods.acceptsBitcoin && {
        btcmap: `https://btcmap.org/merchant/${osmResult.osm_type}:${osmResult.osm_id}`,
      }),
    };

    const addressComponents = {
      houseNumber:
        osmTags["addr:housenumber"] || osmResult.address?.house_number,
      road: osmTags["addr:street"] || osmResult.address?.road,
      city: osmTags["addr:city"] || osmResult.address?.city,
      postcode: osmTags["addr:postcode"] || osmResult.address?.postcode,
      state: osmTags["addr:state"] || osmResult.address?.state,
      country: osmTags["addr:country"] || osmResult.address?.country,
      countryCode: osmResult.address?.country_code,
    };

    return {
      coords,
      osmInfo: {
        displayName: osmResult.display_name,
        id: osmResult.osm_id,
        type: osmResult.type,
        tags: osmResult.tags || {},
      },
      paymentMethods,
      mapLinks,
      formattedName: osmTags.name,
      formattedAddress: addressFormatter.format(addressComponents),
    };
  } catch (error) {
    console.error("Location service error:", error);
    return null;
  }
}

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
}

/** Distance in kilometres between two coordinates (Haversine). */
export function calculateDistance(
  coord1: GeolocationCoordinates,
  coord2: GeolocationCoordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Resolve the visitor's current position via the browser geolocation API. */
export function getCurrentLocation(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
}
