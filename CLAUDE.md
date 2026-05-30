# Meetstr

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
- **UI**: Tailwind CSS v4 + shadcn/ui + Geist font (MUI still present, being removed in Phase 6)
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
      calendar/[id]/route.ts        # server-side calendar fetch + location enrichment
      calendar/[id]/ics/route.ts    # ICS export
      og/calendar/[id]/route.tsx    # OG image for calendars
      og/event/[id]/route.tsx       # OG image for events
    calendar/[id]/                  # calendar detail page
    calendars/                      # browse calendars
    event/[id]/                     # event detail page
    events/                         # main events feed (default landing)
    map/                            # events map (Phase 5 — pins, radius filter, geolocation)
    new-event/                      # create event (Phase 4 — nova create form)
    new-calendar/                   # create calendar (legacy MUI)
  components/
    common/
      blossoms/                     # image upload (Blossom protocol)
      calendar/                     # calendar cards, popular calendars
      events/                       # event cards, filters, RSVP, comments, attendees (legacy MUI)
      fab/                          # floating action buttons
      form/                         # geo search, date picker, tag input, etc.
      layout/                       # app bar, navigation rail, logo
      notification/
    NostrEventCreation/             # calendar creation form
  features/
    calendar/components/            # CalendarOverview
    event/components/               # EventOverview
  hooks/
    useTheme.ts                     # reads/writes data-theme + localStorage
    useActiveUser.ts
    useBlossomUpload.ts
    useCalendarData.ts
    useCalendarEvents.ts
    useLocationInfo.ts              # resolves location string/geohash → coords via Nominatim
    useNostrEvent.ts                # fetch single event by id/naddr
    useRsvpHandler.ts
  lib/
    ndkClient.ts                    # server-side NDK singleton
    i18n.ts
  components/
    nova/
      layout/
        NovaShell.tsx               # root shell wrapper (top bar + main + bottom nav)
        TopBar.tsx                  # sticky frosted header; desktop nav + controls
        BottomNav.tsx               # floating pill nav (mobile only)
        ThemeToggle.tsx             # light/dark toggle, persists to localStorage
        LoginButton.tsx             # triggers nostr-login modal
      events/
        useNovaEvents.ts            # fetch + filter hook (day, tags); uses NDK directly
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
        useNovaMapEvents.ts         # fetch + day filter + coord resolution (geohash→decode, location→geocodeCache) + Haversine radius filter + geolocation
        NovaMapPage.tsx             # map page composition (overlays + dynamic ssr:false map)
        EventMap.tsx                # react-leaflet map: themed CARTO tiles, CircleMarker pins + popups, radius Circle, user-location marker, fly/fit controller
        RadiusFilter.tsx            # distance filter: quick-select chips + slider
        MapControls.tsx             # floating zoom +/- and crosshair (browser geolocation)
  providers/
    ClientProviders.tsx             # NDK init, nostr-login, React Query, i18n (no MUI)
  services/
    authService.ts
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
      locationUtils.ts              # Nominatim calls, Haversine, legacy hardcoded city dict (Phase 6 removal)
      geocodeCache.ts               # Nominatim + Dexie geocoding cache (Phase 4 — replaces the dict)
      osmTags.ts                    # Overpass API for OSM tags (Bitcoin payment info)
    nostr/
      eventCacheUtils.ts            # in-memory Map cache (legacy — used by PopularCalendars; delete in Phase 6)
      eventUtils.ts                 # getEventMetadata(), republishEvent(), deleteEvent()
      nipValidator.ts               # NIP-01, NIP-52, NIP-26, NIP-19 validators
      nostrUtils.ts                 # fetchEventById(), fetchCalendarEvents()
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
| `wss://relay.damus.io` | Only Nostr relay | `ndkClient.ts`, `ClientProviders.tsx` |
| Nominatim (OpenStreetMap) | Geocoding: location string → coords | `locationUtils.ts`, `FormGeoSearchField` |
| Overpass API | OSM tags (Bitcoin payment info) | `osmTags.ts` |
| `blossom.nostr.build` | Image uploads (Blossom protocol) | `useBlossomUpload.ts` |
| OpenStreetMap embed | Map iframe in event detail | `NovaEventMap.tsx` |
| CARTO basemaps | Raster map tiles for the map view | `EventMap.tsx` (Phase 5) |

## Architecture

**Almost entirely client-side.** NDK opens a WebSocket from the browser directly to relay.damus.io.

`src/middleware.ts` is **not** Nostr-related — it only handles i18n cookie/header detection.

### Main events feed flow

1. `ClientProviders.tsx` initialises NDK (with `ndk-cache-dexie` adapter) + nostr-login on the client
2. `useNovaEvents` calls `ndk.fetchEvents({ kinds:[31922,31923], since:now-30d, limit:1000 })`; on repeat visits NDK returns cached events from IndexedDB instantly before hitting the relay
3. `useMemo` filters client-side by: selected day, active tag chips
4. `NovaEventsPage` renders `DaySwitcher` + `TagFilterChips` + a 3-column `NovaEventCard` grid

### One server-side exception

`GET /api/calendar/[id]` runs on the server. It fetches a specific calendar (31924) and its events via the server-side NDK singleton, does date filtering, enriches events with Nominatim location data via DataLoader (rate-limited), and returns JSON.

## Known Bugs / Limitations

### Location / distance filter
- The legacy `isLocationWithinRadius()` only resolves coordinates for ~30 hardcoded DACH cities (`LOCATION_NORMALIZATIONS` in `locationUtils.ts`), used only by the legacy `EventFilters.tsx`.
- **Replacement built in Phase 4:** `geocodeCache.ts` geocodes arbitrary location strings via Nominatim and caches coords in IndexedDB (Dexie, 30-day TTL), keyed by the normalised string. The create form pre-warms it on every location pick. **Phase 5's map radius filter now consumes it** (`useNovaMapEvents.ts`): geohash `g` tags decode instantly, location strings fall back to `geocodeLocation`, and `calculateDistance` (Haversine) filters by radius from a center set via geolocation or search. The hardcoded dict + legacy `EventFilters` are deleted together in Phase 6.

### Nominatim language - #6 (still open)
- `FormGeoSearchField` (legacy) and the nova `LocationSearchInput` both pass `accept-language: "en"` so saved location strings stay consistent across users.
- Trade-off: Italian users see "London" instead of "Londra". The preference for local-language names (which breaks cross-user text matching) is still unresolved — out of Phase 4 scope.

### Timezone handling
- **Display half — FIXED in Phase 3.** The nova detail page formats via `eventSchedule.ts`, which passes `start_tzid`/`end_tzid` into `Intl.DateTimeFormat` with `timeZone` + `timeZoneName:"short"` (e.g. "9:00 AM – 5:00 PM EST"). Invalid IANA ids fall back to the viewer's local zone. The legacy `EventTimeDisplay` (MUI) still ignores tzid but is no longer on the detail route.
- **Save half — FIXED in Phase 4.** The nova create form (`useCreateEvent.ts`) interprets the picked wall-clock time in the selected zone via `dayjs.tz(wallClock, timezone).unix()`, and the timezone is auto-detected from the picked location's coordinates with `tz-lookup` (user-overridable). The legacy `CreateNewEventDialog` (MUI) still has the bug but is off the nova route.

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
| `eventCache` Map (`eventCacheUtils.ts`) | Event arrays (legacy, PopularCalendars only) | 45 min | No |
| TanStack Query | Per-query cache | 5 min stale / 30 min gc | No |
| `useLocationInfo` query | Nominatim results | 1 hour | No |
| `nominatimCache` object (`locationUtils.ts`) | Raw Nominatim JSON | Forever (module lifetime) | No |
| DataLoader (`loader.ts`) | Location lookups | Per-request | No |

## i18n

Translations in `public/locales/{en,de,es}/translation.json`.  
Language detected from cookies (`lang`, `i18next`) or `Accept-Language` header.  
Italian users get German fallback in dayjs locale (`dayjsConfig.ts:33`), but should use English. Any language that hasn't a translation should fallback to English.

## Future Improvements

### Nova UI — Phase 5 complete (branch: nova-map)

The nova UI rebuild is in progress. Phases 1–5 are done.

**Phase 1 (branch: nova-foundation):**
- `ClientProviders` stripped to base layer (NDK, React Query, i18n, nostr-login — no MUI)
- Tailwind 4 + Geist + shadcn/ui installed; dual-theme CSS custom properties in `globals.css`
- Nova app shell: `NovaShell`, `TopBar`, `BottomNav`, `ThemeToggle`, `LoginButton`
- shadcn dark variant wired to `data-theme="dark"` (not `.dark` class)

**Phase 2 (branch: nova-events-list):**
- `ndk-cache-dexie` wired as NDK cache adapter — IndexedDB persistence across refreshes
- `UpcomingEventsSection` and `fetchEventsQuick` removed; replaced by `useNovaEvents` hook
- Nova events list page: `DaySwitcher`, `TagFilterChips`, `NovaEventCard`, 3-column grid
- Nominatim `accept-language: "en"` fix applied (untested pending event creation UI)
- `nostr-login` banner disabled (`noBanner: true`) — modal only on explicit user action

**Phase 3 (branch: nova-event-detail):**
- `getEventMetadata` now exposes NIP-52 text fields separately — `shortDescription` (`summary` tag), `description` (`description` tag), `content` (`event.content`) — without changing the legacy combined `summary` field that ~15 calendar/OG/ICS/search consumers still read. Detail page shows short_description = `summary`, main_text = `content || description`.
- `image` falls back to a legacy `cover` tag.
- New event detail route: MUI `EventOverview` replaced by `NovaEventDetail` (`EventPageClient` uses `use(params)` + nova). Skeleton-first SSR shell; `useNovaEvent` subscribes cache-first so cached text paints instantly while cover image, map (Nominatim) and Overpass payment badges fill in progressively.
- RSVP is functional and nova-native (`useNovaRsvp`): publishes kind 31925, retracts the prior RSVP via a kind-5 deletion, prompts `nlLaunch` login when logged out. No SnackbarContext/i18next dependency (not in the stripped providers).
- Like button: local visual toggle only, **publishes nothing** (deferred). Flag menu (spam/block/hide): UI only, handlers are placeholders pending moderation logic.
- Timezone *display* fixed via `eventSchedule.ts` (see Timezone handling above). Save-side fix landed in Phase 4.
- "Related Events" (in the design) intentionally deferred to Phase 7 (tag/organizer similarity).

**Phase 4 (branch: nova-event-creation):**
- New `/new-event` route (the nav already linked to it; it 404'd before). Nova create form (`NovaCreateEventPage`) replaces the MUI `CreateNewEventDialog`; publishes kind 31923 via `useCreateEvent` (NDK-native signing, prompts `nlLaunch` when logged out).
- **Timezone save bug fixed:** times are read from `datetime-local` (zone-less wall-clock) and saved with `dayjs.tz(wallClock, timezone).unix()`. Verified across machine zones (Rome/NY users both produce correct Tokyo timestamps).
- **Timezone auto-detected** from the picked location's coordinates via `tz-lookup` (browser-safe; chosen over the Node-only `geo-tz` named in the original plan), user-overridable through the timezone `<select>`.
- Form fields: cover upload (`CoverImageInput` → `useBlossomUpload`), title, short summary (`summary` tag), description (`content`), location (`LocationSearchInput`), start/end, timezone, hashtags + links (`TagInput`). Calendar-reference picker intentionally omitted for now.
- **Geocode cache (`geocodeCache.ts`):** Nominatim + Dexie (direct), 30-day TTL, keyed by normalised location string. The replacement for the hardcoded DACH dict; pre-warmed on each location pick, consumed by Phase 5's radius filter. Legacy dict + `EventFilters` removed in Phase 6.

**Phase 5 (branch: nova-map):**
- New `/map` route (was linked in `TopBar`/`BottomNav` but 404'd). `NovaMapPage` composes a full-bleed `react-leaflet` map with overlay controls; the map is loaded via `next/dynamic` with `ssr:false` (leaflet touches `window`). `leaflet` + `@types/leaflet` added as deps (react-leaflet v5 was already present).
- **Pins:** `useNovaMapEvents` fetches the same upcoming events as the list, filters to the selected day (shared `DaySwitcher`), then resolves a coordinate per event — `g` geohash decoded instantly via `decodeGeohash`, otherwise the `location` string is geocoded through the cached/rate-limited `geocodeLocation` (so pins fill in progressively and only the selected day is geocoded). `EventMap` renders one `CircleMarker` per event with a click-popup card (title, category, time, location, "View details" → `/event/<naddr>`). Themed CARTO raster tiles (light voyager / dark dark_all) switch with `useTheme`.
- **Radius filter:** `RadiusFilter` = quick-select chips (1/5/10/25/50 km + Any) plus a 1–100 km slider. Distance is measured with `calculateDistance` (Haversine) from a center point; a `Circle` visualises the radius and out-of-range pins are hidden.
- **Geolocation:** `MapControls` (floating bottom-right) has zoom +/- and a crosshair that calls `getCurrentLocation()` → sets the center to "Your location" and defaults radius to 25 km. The center can also be set by the location search in the top overlay. A `MapController` flies to the center on change and fits all pins into view once per day.
- Leaflet popup/attribution chrome is re-skinned to nova surface tokens in `globals.css`.
- Deferred: clustering for dense areas, persisting the chosen center/radius, and a list⇆map shared filter state.

**Design system:** two variants in `WORKING/NEW_UI/`:
- **Aetheric Lumina** — light, purple primary `#7c2db1`, surface `#fbf8ff`. Ref screens: `events_list_mobile_light`, `event_details_mobile_light`, `events_map_desktop_light`
- **Aetheric Technical** — dark, primary `#e9b3ff`, background `#151217`. Ref screens: `event_details_updated_nav`, `event_details_wide_map`

**Remaining legacy work** (Phase 6): delete legacy MUI components and `eventCacheUtils.ts` once nova covers all views.
