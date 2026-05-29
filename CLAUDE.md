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
- **Location search**: leaflet-geosearch (OpenStreetMapProvider → Nominatim)
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
    new-calendar/                   # create calendar
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
      locationUtils.ts              # Nominatim calls, Haversine, hardcoded city dict
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
| `summary` | no | brief description (secondary) |
| `start` | yes | Unix timestamp (31923) or ISO date (31922) |
| `end` | no | Unix timestamp or ISO date |
| `start_tzid` | no | IANA timezone identifier |
| `end_tzid` | no | IANA timezone identifier |
| `location` | no | human-readable string |
| `g` | no | geohash (6–7 chars recommended for venue precision) |
| `image` | no | URL (use `image`, not `cover`) |
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
| OpenStreetMap embed | Map iframe in event detail | `EventLocationMapCard.tsx` |

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

### Relay filtering - #5
- `since`/`until` in NDK filters apply to `created_at`, **not** NIP-52 `start` tag
- Events published more than 7 days ago with future start dates are missed

### Location / distance filter
- `isLocationWithinRadius()` only resolves coordinates for ~30 hardcoded DACH cities
- Any other location string → no coordinates → radius filter excludes the event
- Fix: geocode location strings via Nominatim and cache results in IndexedDB (Dexie)

### Nominatim language - #6
- `FormGeoSearchField` uses `leaflet-geosearch` with no `accept-language` param
- Nominatim returns names in browser language: Italian users get "Londra", "San Paolo"
- Saved location strings are inconsistent across users → text matching breaks
- Fix: `new OpenStreetMapProvider({ params: { "accept-language": "en" } })`

### Timezone handling
- Date picker creates dayjs objects in browser's local timezone, ignoring the selected `start_tzid`
- If a Rome-based user creates a Tokyo event and picks "09:00", the saved Unix timestamp is 09:00 Rome time, not 09:00 Tokyo time
- `start_tzid` is read from events but **never used for display** — times always shown in viewer's local timezone
- Fix (saving): `dayjs.tz(pickedDateTime, selectedTimezone).unix()`
- Fix (display): pass `start_tzid` to `EventTimeDisplay` and format with `date.toLocaleString(locale, { timeZone: start_tzid })`

### Content field
- NIP-52 specifies `content` as the canonical description field
- `eventUtils.ts` reads only `summary` tag, never `event.content`
- Events from other NIP-52 clients that use only `content` show no description
- Fix: `summary: getTagValue("summary") || getTagValue("description") || event.content`

### Event detail page slowness
- Clicking an event fetches it fresh from the relay every time
- `ndk-cache-dexie` is now wired (Phase 2), so NDK will serve the event from IndexedDB on repeat visits; first-visit cold load is still slow

### Blossom server
- Image upload server hardcoded to `blossom.nostr.build`
- BUD-03 user server list (kind 10063) is not respected
- Fix: fetch user's kind 10063 event and use their preferred server

### Events loading only in active tags

Events don't load when clicking "open in a new tab" (background tab).

## Performance Notes

- Haversine distance formula on 2000 events: < 1ms, not a concern
- The expensive part of distance filtering is geocoding location strings (Nominatim, rate-limited at ~1 req/sec)
- Recommended: cache geocoded coordinates in IndexedDB (Dexie), keyed by normalised location string, TTL ~30 days
- `@nostr-dev-kit/ndk-cache-dexie` is now wired as the NDK cache adapter — event fetches are instant after first load, persisting across page refreshes

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
Italian users get German fallback in dayjs locale (`dayjsConfig.ts:33`).

## Future Improvements

### Nova UI — Phase 2 complete (branch: nova-events-list)

The nova UI rebuild is in progress. Phases 1 and 2 are done.

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

**Design system:** two variants in `WORKING/NEW_UI/`:
- **Aetheric Lumina** — light, purple primary `#7c2db1`, surface `#fbf8ff`. Ref screens: `events_list_mobile_light`, `event_details_mobile_light`, `events_map_desktop_light`
- **Aetheric Technical** — dark, primary `#e9b3ff`, background `#151217`. Ref screens: `event_details_updated_nav`, `event_details_wide_map`

**Remaining legacy work** (Phase 6): delete legacy MUI components and `eventCacheUtils.ts` once nova covers all views.
