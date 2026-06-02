# miTi

**miTi** is an open-source Nostr client for finding and publishing calendar events. It speaks [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md), so calendars and events created anywhere on the network appear here, and anything you publish from miTi propagates back out to every other Nostr client. Everything runs in the browser: discover what's happening, open the full details, place an event on a map, and add your own to the network.

## Features

- 📅 Browse NIP-52 calendars and date/time-based events (kinds 31922–31924)
- 🔎 Detailed event and calendar pages, including NIP-52 RSVPs (kind 31925)
- 🗺️ Map view with a distance-radius filter and geolocation
- ✍️ Publish your own events and calendars, with Blossom cover-image uploads
- 🌍 Timezone-correct scheduling and display
- 📥 Export any calendar to `.ics`, or subscribe to it over webcal
- 🔗 Auto-generated OpenGraph previews so shared links unfurl cleanly
- 🌐 Available in English, German, and Spanish

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript 5
- **UI**: Tailwind CSS v4 + shadcn/ui + Geist font
- **Nostr**: `@nostr-dev-kit/ndk` v2 with `ndk-cache-dexie` (IndexedDB), nostr-tools, nostr-login
- **Data fetching**: TanStack React Query v5
- **Maps**: react-leaflet v5 + Leaflet, CARTO basemaps
- **Geocoding**: Nominatim (OpenStreetMap) + Overpass, cached in IndexedDB via Dexie
- **Uploads**: Blossom protocol (`blossom.nostr.build`)
- **i18n**: i18next + react-i18next

Nearly all of the work happens client-side: NDK opens WebSockets straight from the browser to the relays. The only server-side code is a thin compatibility layer (the OpenGraph image routes, `generateMetadata`, and the ICS feed) that lets non-browser consumers such as link-preview crawlers and calendar apps still get useful output.

## Requirements

- Node.js 22 or newer

## Getting Started

```bash
npm install
cp .env.example .env.local   # optional; every variable has a sensible default
npm run dev
```

Then open http://localhost:3000.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server (http://localhost:3000) |
| `npm run build` | Production build (runs `lint` first via `prebuild`) |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint, with zero warnings allowed |
| `npm run lint:fix` | Auto-fix lint issues |

## Environment Variables

**Every variable is optional.** With nothing set, the app runs on `localhost:3000` in dev, and on a deploy it auto-detects its public origin from the request host, so a free `*.vercel.app` URL works with zero configuration. Set these only when you want to override that behavior.

Copy `.env.example` to `.env.local` to get started. Anything read by the browser must carry the `NEXT_PUBLIC_` prefix, which Next.js inlines into the client bundle at **build** time.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | auto-detected | Canonical public origin (scheme + host, no trailing slash) used for canonical links, OpenGraph/Twitter URLs, and the metadata base. Set it once you have a **stable custom domain** so SEO canonicals don't drift between `*.vercel.app` and the real domain. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | unset (analytics off) | The site key registered in your [Plausible](https://plausible.io) dashboard. The analytics `<script>` loads **only when this is set**, so localhost and preview deploys report nothing. |
| `NEXT_PUBLIC_I18N_DEBUG` | `false` | Set to `"true"` for verbose i18next logging in the console. |

### Platform-injected (do not set manually)

The runtime and host provide these automatically; they feed the base-URL resolver in `src/lib/baseUrl.ts` as fallbacks.

| Variable | Source |
|---|---|
| `NODE_ENV` | Set by Next.js (`development` / `production`) |
| `PORT` | Dev/start port (defaults to `3000`) |
| `VERCEL_PROJECT_PRODUCTION_URL` | Stable production domain, injected on Vercel |
| `VERCEL_URL` | Per-deploy URL, injected on Vercel |

The resolver picks the first of these that is available, in priority order: `NEXT_PUBLIC_SITE_URL`, then the `x-forwarded-host` / `x-forwarded-proto` request headers, then the Vercel variables, and finally `localhost`. That chain keeps dev, free deploys, and a future custom domain working without any code changes.

## Deployment

The production instance runs on **port 4000 under PM2** (configured in `ecosystem.config.cjs`). It also deploys to Vercel as-is, where the host and base URL are detected for you.

## Contributing

Pull requests and issues are both welcome, whether it's a bug, a feature idea, a translation, or a fix. For anything larger, opening an issue first to talk through the approach tends to save everyone time.

## License

miTi is distributed under the **GNU Affero General Public License v3.0** (AGPL-3.0). You may run, study, modify, and share it; in exchange, any networked deployment or derivative must stay AGPL-3.0 and make its own source available. The full terms are in [LICENSE](./LICENSE).

---

Shipped without warranty, so run it at your own risk, and built in the hope of a freer, more decentralized web.
