import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by Serwist at build time: the precached app-shell asset list.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Meetstr-specific runtime caching for third-party assets.
//
// Nostr relay traffic is WebSocket-based and cannot be intercepted by a service
// worker, so it is intentionally absent here — offline reads already come from
// ndk-cache-dexie (IndexedDB). Server routes (/api/*, /api/og/*, generateMetadata
// pages) are excluded from precache and fall through to the network so crawlers
// and calendar apps always hit the real handlers.
const meetstrCache: RuntimeCaching[] = [
  {
    // CARTO basemap raster tiles (map view) — effectively immutable.
    matcher: ({ url }) => url.hostname.endsWith("basemaps.cartocdn.com"),
    handler: new CacheFirst({
      cacheName: "carto-map-tiles",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 256,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        }),
      ],
    }),
  },
  {
    // Blossom-hosted images (event covers, avatars).
    matcher: ({ url, request }) =>
      url.hostname === "blossom.nostr.build" && request.destination === "image",
    handler: new CacheFirst({
      cacheName: "blossom-images",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    }),
  },
  {
    // Geocoding / OSM tag lookups — refresh in the background, usable offline.
    matcher: ({ url }) =>
      url.hostname === "nominatim.openstreetmap.org" ||
      url.hostname.endsWith("overpass-api.de"),
    handler: new StaleWhileRevalidate({
      cacheName: "osm-geo-data",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...meetstrCache, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
