# miTi

NIP-52 Nostr calendar event discovery and creation app.

## Commands

```bash
npm run dev       # development server
npm run build     # production build (runs lint first via prebuild)
npm run start     # production server
npm run lint      # ESLint, zero warnings allowed
npm run lint:fix  # auto-fix lint issues
```

Production runs on port 4000 via PM2 (`ecosystem.config.cjs`).

## Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript 5
- **UI**: Tailwind CSS v4 + shadcn/ui + Geist font (MUI fully removed in Phase 6 — entire app is nova/Tailwind)
- **Nostr**: `@nostr-dev-kit/ndk` v2 + `ndk-cache-dexie` (IndexedDB cache), nostr-hooks, nostr-tools, nostr-login
- **Data fetching**: TanStack React Query v5
- **Date/time**: dayjs with utc + timezone plugins
- **Timezone from coords**: `tz-lookup` (browser-safe lat/lon → IANA; used when a location is picked in the create form)
- **Maps**: `react-leaflet` v5 + `leaflet` (Phase 5 map view); raster tiles from CARTO basemaps (light: voyager, dark: dark_all)
- **Location search**: leaflet-geosearch (OpenStreetMapProvider → Nominatim)
- **IndexedDB**: `dexie` (direct dep) — geocode cache; also bundled transitively by `ndk-cache-dexie`
- **File uploads**: blossom-client-sdk → blossom.nostr.build
- **i18n**: i18next + react-i18next (English, German, Spanish)
- **Path alias**: `@/` → `src/`

## Directory Structure

```
src/
  app/
    api/
      calendar/[id]/ics/route.ts    # ICS feed: webcal subscription + download (server-side, relay-hinted)
      og/calendar/[id]/route.tsx    # OG image for calendars
      og/event/[id]/route.tsx       # OG image for events
    calendar/[id]/                  # calendar detail page
    calendars/                      # browse calendars
    event/[id]/                     # event detail page
    events/                         # main events feed (default landing)
    map/                            # events map (Phase 5 — pins, radius filter, geolocation)
    new-event/                      # create event (Phase 4 — nova create form; ?calendar= adds to a calendar)
    new-calendar/                   # create/edit calendar (Phase 6 — nova form; ?edit=<naddr>)
  components/
    LanguageProvider.tsx            # i18n language provider (currently unused)
    structured-data/                # EventStructuredData (JSON-LD; currently unused)
    ui/                             # shadcn primitives (button)
    nova/
      layout/
        NovaShell.tsx               # root shell wrapper (top bar + main + bottom nav)
        TopBar.tsx                  # sticky frosted header; desktop nav + controls
        BottomNav.tsx               # floating pill nav (mobile only)
        ThemeToggle.tsx             # light/dark toggle, persists to localStorage
        LoginButton.tsx             # triggers nostr-login modal
      events/
        eventsStore.ts              # app-wide events store: ONE shared NDK subscription feeds /list + /map; in-memory snapshot survives navigation; 1h staleness gate + forced refresh; useSyncExternalStore
        useNovaEvents.ts            # filter hook (day, tags, location) over the eventsStore snapshot; exposes refresh/fetching
        NovaEventsPage.tsx          # events list page composition
        NovaEventCard.tsx           # uniform card: aspect-video image + content
        DaySwitcher.tsx             # horizontal scrollable day picker
        TagFilterChips.tsx          # horizontal scrollable tag filter
      event/                        # event detail (Phase 3)
        useNovaEvent.ts             # fetch single event by naddr/id, cache-first subscription
        useNovaRsvp.ts              # NIP-52 RSVP (kind 31925) publish/retract — NDK-native
        eventSchedule.ts            # tzid-aware date/time formatting for display
        calendarLinks.ts            # Google Calendar URL + .ics builder (client-side)
        NovaEventDetail.tsx         # detail page composition (skeleton-first, progressive)
        NovaEventActions.tsx        # hero like (local toggle, no publish) + flag menu (UI only)
        NovaEventHost.tsx           # organizer avatar + name via useProfile
        NovaEventMap.tsx            # progressive OSM embed + Overpass payment badges + map links
        NovaEventRsvp.tsx           # RSVP segmented control (Going / Maybe / Can't go)
        NovaAddToCalendar.tsx       # Google + .ics download buttons
      create/                       # event creation (Phase 4)
        NovaCreateEventPage.tsx     # form composition + submit; tz auto-detect via tz-lookup
        useCreateEvent.ts           # publish kind 31923 (NDK-native); timezone SAVE fix lives here
        CoverImageInput.tsx         # blossom cover upload (reuses useBlossomUpload)
        LocationSearchInput.tsx     # debounced Nominatim combobox → coords (drives tz + geohash)
        TagInput.tsx                # chip input (hashtags / reference links)
      map/                          # events map (Phase 5)
        useNovaMapEvents.ts         # day filter over eventsStore + coord resolution (geohash→decode, location→geocodeCache); exposes refresh/fetching
        NovaMapPage.tsx             # map page composition (overlays + dynamic ssr:false map)
        EventMap.tsx                # react-leaflet map: themed CARTO tiles, CircleMarker pins + popups, radius Circle, user-location marker, fly/fit controller
        RadiusFilter.tsx            # distance filter: quick-select chips + slider
        MapControls.tsx             # floating zoom +/- and crosshair (browser geolocation)
      calendar/                     # calendar feature (Phase 6 — nova; replaces all legacy MUI)
        useNovaCalendars.ts         # fetch kind 31924 + search/hide-empty/hide-test filters
        NovaCalendarsPage.tsx       # /calendars browse: search + filters + grid
        NovaCalendarCard.tsx        # calendar card: image, title, host, event count
        useNovaCalendar.ts          # single calendar + events (upcoming/past) + unapproved query
        NovaCalendarDetail.tsx      # /calendar/[id]: hero, host, ICS, owner edit/delete, approve, sections
        NovaCalendarActions.tsx     # owner edit/delete menu (NDK kind-5 delete)
        NovaCalendarIcs.tsx         # subscribe / download .ics / copy webcal link
        useCalendarMutations.ts     # NDK-native create/edit/delete + approveEvent (kind 31924)
        NostrEntityPicker.tsx       # kind-filtered entity picker (paste naddr / text search)
        NovaCreateCalendarPage.tsx  # /new-calendar create + ?edit=<naddr> edit form
  hooks/
    useTheme.ts                     # reads/writes data-theme + localStorage
    useActiveUser.ts                # nostr-login user via nlAuth/nlLogout events (NDK-native; no authService)
    useBlossomUpload.ts             # blossom cover upload; signs via window.nostr
    useCalendarData.ts
    useCalendarEvents.ts
    useLocationInfo.ts              # resolves location string/geohash → coords via Nominatim (DataLoader)
  lib/
    relays.ts                       # DEFAULT_RELAYS — single source of truth (imported by client + server)
    ndkClient.ts                    # server-side NDK singleton (4 relays)
    i18n.ts
    utils.ts                        # cn() classname helper
  providers/
    ClientProviders.tsx             # NDK init (4 relays), nostr-login, React Query, i18n (no MUI)
  types/
    location.ts
    nostr.ts                        # (empty)
  utils/
    formatting/
      date.ts                       # formatDate, formatDateRange (uses browser locale)
      dayjsConfig.ts                # dayjs configured with utc + timezone plugins
    location/
      geohash.ts                    # encode/decode geohash (custom implementation)
      loader.ts                     # DataLoader wrapper for batched Nominatim calls
      locationUtils.ts              # getLocationInfo (Nominatim+Overpass), calculateDistance (Haversine), getCurrentLocation
      geocodeCache.ts               # Nominatim + Dexie geocoding cache (Phase 4 — replaces the old dict)
      osmTags.ts                    # Overpass API for OSM tags (Bitcoin payment info)
    nostr/
      eventUtils.ts                 # getEventMetadata()
      nipValidator.ts               # NIP-01, NIP-52, NIP-26, NIP-19 validators
      nostrUtils.ts                 # fetchEventById() (timeout + relay-hints), fetchCalendarEvents(), encodeEventToNaddr(), encodeNaddrWithRelays()
    seo/
      hashtagExtractor.ts
  middleware.ts                     # i18n only: reads Accept-Language, sets cookies
```

## Nostr Event Kinds

| Kind | Name | Notes |
|---|---|---|
| 31922 | Date-based calendar event | `start` is ISO 8601 date string |
| 31923 | Time-based calendar event | `start`/`end` are Unix timestamps |
| 31924 | Calendar list | References events via `a` tags |

## NIP-52 Tag Reference

| Tag | Required | Notes |
|---|---|---|
| `d` | yes | unique identifier |
| `title` | yes | event name |
| `content` | yes (can be empty) | **canonical full description** |
| `summary` | no | short description (secondary) |
| `start` | yes | Unix timestamp (31923) or ISO date (31922) |
| `end` | no | Unix timestamp or ISO date |
| `start_tzid` | no | IANA timezone identifier |
| `end_tzid` | no | IANA timezone identifier |
| `location` | no | human-readable string |
| `g` | no | geohash (6–7 chars recommended for venue precision) |
| `image` | no | URL; canonical tag. `getEventMetadata` falls back to a legacy `cover` tag when `image` is absent |
| `t` | no | hashtag, repeatable |
| `r` | no | reference URL, repeatable |
| `p` | no | participant pubkey, repeatable |
| `a` | no | reference to calendar (31924) |

## External Services

| Service | Usage | Where |
|---|---|---|
| `relay.damus.io`, `nos.lol`, `nostr.wine` | Nostr relays | `ndkClient.ts`, `ClientProviders.tsx` |
| Nominatim (OpenStreetMap) | Geocoding: location string → coords | `locationUtils.ts`, `geocodeCache.ts`, `LocationSearchInput` |
| Overpass API | OSM tags (Bitcoin payment info) | `osmTags.ts` |
| `blossom.nostr.build` | Image uploads (Blossom protocol) | `useBlossomUpload.ts` |
| OpenStreetMap embed | Map iframe in event detail | `NovaEventMap.tsx` |
| CARTO basemaps | Raster map tiles for the map view | `EventMap.tsx` (Phase 5) |

## Architecture

**Almost entirely client-side.** NDK opens WebSockets from the browser directly to the relays (relay.damus.io, nos.lol, nostr.wine).

`src/middleware.ts` is **not** Nostr-related — it only handles i18n cookie/header detection.

### Main events feed flow

1. `ClientProviders.tsx` initialises NDK (with `ndk-cache-dexie` adapter) + nostr-login on the client
2. `eventsStore.ts` (module-level, shared by /list and /map) holds the one subscription: `ndk.subscribe({ kinds:[31922,31923], since:now-30d, limit:1000 }, CACHE_FIRST, closeOnEose)`. Start timestamps are precomputed on insert and flushes are debounced (50ms), so bursts sort plain numbers once instead of re-sorting with dayjs per event (the old per-event flush was O(n² log n) and froze navigation for seconds)
3. The deduped/sorted snapshot lives in memory across navigation: a page remount renders it synchronously (no skeleton) and only re-queries relays when the last EOSE is >1h old, or via the refresh buttons on /list and /map (re-fetches use `ONLY_RELAY` — memory already holds the Dexie cache's contents)
4. `useNovaEvents` / `useNovaMapEvents` filter the snapshot client-side by selected day, tag chips, location radius
5. `NovaEventsPage` renders `DaySwitcher` + `TagFilterChips` + a 3-column `NovaEventCard` grid

### Server-side surface

A handful of endpoints run on the server via the `getNdk()` singleton (no signer, no dexie cache): the two `generateMetadata` functions (`event/[id]`, `calendar/[id]`), the OG image routes (`og/event/[id]`, `og/calendar/[id]`), and the ICS feed (`calendar/[id]/ics`). Each does a **bounded** relay fetch — `fetchEventById(..., { timeoutMs: 3000 })` — and falls back to generic-but-200 output on miss/timeout so crawlers never get a broken preview; the ICS feed additionally honours relay hints embedded in the calendar naddr. These exist only to serve non-browser consumers (link-preview crawlers, calendar apps) that can't run the client.

(The old `GET /api/calendar/[id]` JSON enrichment route was **removed** — orphaned after the Phase 6 nova migration, which moved geocoding client-side to `geocodeCache`.)

## Known Bugs / Limitations

### Location / distance filter
- The legacy hardcoded DACH city dict (`LOCATION_NORMALIZATIONS`) + `isLocationWithinRadius()` were **removed in Phase 6** (only the deleted `EventFilters` used them).
- `geocodeCache.ts` geocodes arbitrary location strings via Nominatim and caches coords in IndexedDB (Dexie, 30-day TTL), keyed by the normalised string. The create form pre-warms it on every location pick, and the map radius filter (`useNovaMapEvents.ts`) consumes it: geohash `g` tags decode instantly, location strings fall back to the cache, and `calculateDistance` (Haversine, in `locationUtils.ts`) filters by radius from a center set via geolocation or search.

### Nominatim language - #6 (still open)
- `FormGeoSearchField` (legacy) and the nova `LocationSearchInput` both pass `accept-language: "en"` so saved location strings stay consistent across users.
- Trade-off: Italian users see "London" instead of "Londra". The preference for local-language names (which breaks cross-user text matching) is still unresolved — out of Phase 4 scope.

### Timezone handling
- **Display half — FIXED in Phase 3.** The nova detail page formats via `eventSchedule.ts`, which passes `start_tzid`/`end_tzid` into `Intl.DateTimeFormat` with `timeZone` + `timeZoneName:"short"` (e.g. "9:00 AM – 5:00 PM EST"). Invalid IANA ids fall back to the viewer's local zone.
- **Save half — FIXED in Phase 4.** The nova create form (`useCreateEvent.ts`) interprets the picked wall-clock time in the selected zone via `dayjs.tz(wallClock, timezone).unix()`, and the timezone is auto-detected from the picked location's coordinates with `tz-lookup` (user-overridable).

### Blossom server
- Image upload server hardcoded to `blossom.nostr.build`
- BUD-03 user server list (kind 10063) is not respected
- Fix: fetch user's kind 10063 event and use their preferred server

### Events loading only in active tags

Events don't load when clicking "open in a new tab" (background tab).

## Performance Notes

- Recommended: cache geocoded coordinates in IndexedDB (Dexie), keyed by normalised location string, TTL ~30 days

## Caching

| Layer | What | TTL | Survives refresh |
|---|---|---|---|
| `ndk-cache-dexie` (IndexedDB) | All NDK events + profiles | Persistent | **Yes** |
| `eventsStore` (in-memory module) | Upcoming 31922/31923, deduped + sorted | 1 h staleness gate (refresh button forces) | No |
| TanStack Query | Per-query cache | 5 min stale / 30 min gc | No |
| `useLocationInfo` query | Nominatim results | 1 hour | No |
| `nominatimCache` object (`locationUtils.ts`) | Raw Nominatim JSON | Forever (module lifetime) | No |
| DataLoader (`loader.ts`) | Location lookups | Per-request | No |

## i18n

Translations in `public/locales/{en,de,es}/translation.json`.  
Language detected from cookies (`lang`, `i18next`) or `Accept-Language` header.  
Italian users get German fallback in dayjs locale (`dayjsConfig.ts:33`), but should use English. Any language that hasn't a translation should fallback to English.

## UI

**Design system:** two variants in `WORKING/NEW_UI/`:

- **Aetheric Lumina** — light, purple primary `#7c2db1`, surface `#fbf8ff`. Ref screens: `events_list_mobile_light`, `event_details_mobile_light`, `events_map_desktop_light`
- **Aetheric Technical** — dark, primary `#e9b3ff`, background `#151217`. Ref screens: `event_details_updated_nav`, `event_details_wide_map`

## Future Improvements

**Deferred / left as-is:** `LanguageProvider`, `components/structured-data/`, `components/ui/button`, and `useCalendarData`/`useCalendarEvents` remain (non-MUI; currently unused).
