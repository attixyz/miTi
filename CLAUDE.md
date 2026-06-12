# miTi

NIP-52 Nostr calendar event discovery and creation app, with an **on-device personalization engine** (like/dislike → ranked feed, suggestions, spam filter) and **private cross-device sync** over Nostr (NIP-78 + NIP-44).

## Commands

```bash
npm run dev       # development server
npm run build     # production build (runs lint first via prebuild)
npm run start     # production server
npm run lint      # ESLint, zero warnings allowed
npm run lint:fix  # auto-fix lint issues
```

## Hosting

Deployed on **Vercel**. `npm run build` runs on each push; Vercel injects `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` and forwarded host headers automatically, so `baseUrl.ts` resolves public URLs (canonical, OG, ICS/webcal) without config. Set `NEXT_PUBLIC_SITE_URL` (Project → Settings → Environment Variables) to pin a stable canonical to the custom domain; it's a `NEXT_PUBLIC_*` var so a **redeploy** is required for it to take effect. Custom domains + TLS are managed in the Vercel dashboard (Settings → Domains).

## Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript 5
- **UI**: Tailwind CSS v4 + shadcn/ui + Base UI (`@base-ui/react`) + lucide-react icons + Geist font (MUI fully removed in Phase 6 — entire app is nova/Tailwind)
- **Nostr**: `@nostr-dev-kit/ndk` v2 + `ndk-cache-dexie` (IndexedDB cache), nostr-hooks, nostr-tools, nostr-login
- **Personalization (taste engine)**: own Dexie DB (`miti-taste`, separate from the NDK cache) + a Web Worker for indexing/scoring; `Intl.Segmenter` tokenization. See "Personalization, spam filter & sync" below
- **Cross-device sync**: NIP-78 app data (kind 30078) + NIP-44 encrypt-to-self; `CompressionStream` (gzip) for the likes payload. Two synced docs: `miti-setting` and `miti-likes`
- **PWA**: Serwist (`@serwist/next` + `serwist`) — service worker, installable app, offline page
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
    page.tsx                        # root landing (sends you into the events feed)
    list/                           # main events feed, ranked by taste (replaces the old /events)
    map/                            # events map (pins, radius filter, geolocation)
    suggested/                      # recommended events (taste + proximity + happening-soon)
    my-feedback/                    # everything you liked / disliked / reported / hidden
    spam/                           # events flagged as spam or too short / low-effort
    tag/[name]/                     # events for one hashtag, ranked by taste
    event/[id]/                     # event detail page
    calendar/[id]/                  # calendar detail page
    calendars/                      # browse calendars
    new-event/                      # create event (nova create form; ?calendar= adds to a calendar)
    new-calendar/                   # create/edit calendar (nova form; ?edit=<naddr>)
    set-location-filter/            # pick place + radius; shared location filter for /list and /map
    settings/                       # taste preferences (which event fields feed the corpus; debug toggle)
    settings/relays/                # relay list + Blossom upload server
    about/                          # about page
    more/                           # mobile overflow nav (items not in the bottom bar)
    debug/words/                    # inspect the word corpus (debug mode only)
    debug/tanh-function/            # tune the squash slope k (debug mode only)
    debug/suggested/                # tune the five suggested-ranking knobs (debug mode only)
    ~offline/                       # PWA offline fallback page
    sw.ts                           # Serwist service worker source
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
        EventCardActions.tsx        # like / dislike / report / hide buttons on each card
        DaySwitcher.tsx             # horizontal scrollable day picker
        TagFilterChips.tsx          # horizontal scrollable tag filter
      event/                        # event detail (Phase 3)
        useNovaEvent.ts             # fetch single event by naddr/id, cache-first subscription
        useNovaRsvp.ts              # NIP-52 RSVP (kind 31925) publish/retract — NDK-native
        eventSchedule.ts            # tzid-aware date/time formatting for display
        calendarLinks.ts            # Google Calendar URL + .ics builder (client-side)
        NovaEventDetail.tsx         # detail page composition (skeleton-first, progressive)
        NovaEventActions.tsx        # like / dislike / report / hide on the detail page (feeds the taste engine)
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
      taste/                        # personalization pages + helpers (like-dislike.md)
        NovaYourFeedbackPage.tsx    # /my-feedback: liked / disliked / reported / hidden lists
        SuggestedPage.tsx           # /suggested: events ranked by suggested_score
        SpamPage.tsx                # /spam: events flagged short_text / high spam score
        useEventsByCoordinate.ts    # resolve taste rows back to cached NDK events
      filter/                       # location filter, shared by /list and /map
        NovaSetLocationFilterPage.tsx
        LocationFilterControl.tsx
      settings/
        NovaSettingsPage.tsx        # /settings: taste element checkboxes + debug toggle
        NovaRelaysPage.tsx          # /settings/relays: relays + Blossom server + reset-to-defaults
      about/NovaAboutPage.tsx       # /about
      more/NovaMorePage.tsx         # /more mobile overflow nav
      debug/                        # debug-only tuning UIs (all behind DebugGate)
        DebugGate.tsx               # blocks the /debug routes unless the debug flag is on
        DebugWordsPage.tsx          # word-corpus table
        DebugTanhPage.tsx           # squash-slope (k) playground
        DebugSuggestedPage.tsx      # suggested-ranking knob sliders
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
    taste/                          # on-device personalization engine (like-dislike.md)
      db.ts                         # the `miti-taste` Dexie DB: words, event_taste, indexed_events, meta, sync_meta
      tokenizer.ts                  # Intl.Segmenter word split + junk filter; which event fields are enabled
      indexer.ts                    # index_event + full reindex; drives the worker
      taste.worker.ts               # Web Worker: all corpus writes, scoring, and likes replay
      messages.ts                   # worker message types
      feedback.ts                   # record_feedback delta engine + merge_taste; React hooks over the rows
      points.ts                     # ACTION_POINTS (like / dislike / report / rsvp / add-to-calendar)
      scoring.ts                    # squash (tanh, slope k), idf, event_score, suggested_score
      scores.ts                     # lazy per-event score cache + HIDDEN_SCORE_THRESHOLD
      spam.ts                       # short_text / spam content signals
      visibility.ts                 # useVisibleEvents — the shared /list + /map hide gate
      tunables.ts                   # debug knobs (k + the five suggested knobs), localStorage-backed
      settings.ts                   # taste element checkboxes + the debug flag
    prefs/                          # NIP-78 cross-device sync (user-preferences.md)
      nip78.ts                      # kind 30078 publish/fetch + NIP-44 encrypt-to-self
      pool.ts                       # reconfigure the relay pool from the synced relay list
      settingsStore.ts              # local `miti-setting` doc (relays, blossom_server, debug); whole-doc LWW
      settingsSync.ts               # sync engine for `miti-setting`
      likesDoc.ts                   # `miti-likes` payload: event_taste rows → gzip → base64
      likesSync.ts                  # sync engine for `miti-likes` (fetch-merge, then publish)
  providers/
    ClientProviders.tsx             # NDK init, nostr-login (now requests sign_event:30078 + nip44 perms), React Query, i18n
    FiltersContext.tsx              # shared day + location/radius filter + map camera state
    SettingsSyncBridge.tsx          # starts the miti-setting + miti-likes sync once a signer is present
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
| 31925 | RSVP | NIP-52 attendance (yes / maybe / no); also feeds the taste engine |
| 30078 | App data (NIP-78) | Encrypted-to-self sync docs, addressed by `d` tag: `miti-setting` and `miti-likes` |

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

## Personalization, spam filter & sync

Three connected systems, all client-side. The taste engine and its data live in `src/lib/taste/`; the sync layer in `src/lib/prefs/`. Design docs (in the separate specs repo): `like-dislike.md` for taste + spam, `user-preferences.md` for sync.

### Taste engine (recommendations)

- **Storage:** its own Dexie DB, `miti-taste` (`lib/taste/db.ts`), kept separate from the NDK event cache so wiping/recomputing it never touches cached events. Tables: `words` (corpus word → weighted `count` + signed `like_score`), `event_taste` (per-event state, keyed by the `kind:pubkey:d` coordinate, not the mutable event id), `indexed_events`, `meta`, `sync_meta`.
- **Indexing:** a Web Worker (`taste.worker.ts`) tokenizes each event with `Intl.Segmenter` + a junk filter (no stopword lists — `tokenizer.ts`) and splits points across the event's words weighted by `weight · idf`. Which fields feed the corpus — title + tags always; description, summary, location optional — is chosen on `/settings`; flipping one triggers a full reindex. All heavy work stays off the main thread.
- **Feedback (delta model):** `record_feedback` (`feedback.ts`) records the change from the previous state, so repeating or switching an action never double-counts. Points (`points.ts`): like +100, dislike −50, report −100, add-to-calendar +200, RSVP yes/maybe/no +300/+150/+30. Like/dislike are mutually exclusive; RSVP is retractable; `hide` removes from view with no points.
- **Scoring (lazy):** feedback only bumps `taste_version`; a route recomputes scores for just the visible events whose cache is stale (`scores.ts`). `scoring.ts` holds `squash` (tanh, slope `k`), `event_score` (idf-weighted mean), and `suggested_score` (taste × proximity × happening-soon). `/list` and `/tag/[name]` sort by score; `/suggested` uses `suggested_score`.

### Spam / low-effort filter

`spam.ts` derives content-only signals (empty or too-short main text; spam score) with no user action involved. `visibility.ts` (`useVisibleEvents`) is the single gate shared by `/list` and `/map`: it drops events the user hid/reported, events scoring under `HIDDEN_SCORE_THRESHOLD`, and short-text events. The `/spam` page lists what the filter caught.

### Cross-device sync (NIP-78 + NIP-44)

Off until a signer can do NIP-44 (extension / bunker / local key); read-only sessions skip it silently. `SettingsSyncBridge` starts two independent engines once a signer is present, each backed by a kind-30078 app-data event addressed by a `d` tag and encrypted **to yourself**:

- **`miti-setting`** (`settingsStore.ts` / `settingsSync.ts`): relays, Blossom server, debug flag. localStorage is the working copy; whole-doc last-write-wins by `updated_at`. Published immediately-on-change (debounced) to the union of your relays + `DEFAULT_RELAYS`.
- **`miti-likes`** (`likesDoc.ts` / `likesSync.ts`): your `event_taste` rows, gzip (`CompressionStream`) → base64 → NIP-44. Synced hourly while open, on tab-hide, and once after login, but only when `taste_version` moved past the last push. Every publish does a fetch-merge first (row-level LWW on `updated_at`), then the worker replays the merged rows to rebuild `words.like_score`.

Relay bootstrap: defaults → fetch `miti-setting` → reconfigure the pool (`prefs/pool.ts`) → live subscription. The synced Blossom server flows into uploads (`useBlossomUpload.ts`), the create-form cover input, and the service-worker image-cache rule.

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
- Now user-configurable: defaults to `blossom.nostr.build`, overridable on `/settings/relays` and synced across devices (`prefs/settingsStore.ts`). Wired into uploads, the cover input, and the SW image cache.
- Still does **not** auto-discover the user's BUD-03 server list (kind 10063) — the value is set by hand.
- Fix: fetch the user's kind 10063 event and pre-fill their preferred server.

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

## PWA / offline

Serwist (`@serwist/next`) compiles `src/app/sw.ts` → `public/sw.js` and registers it. The app is installable (web manifest + icons in `public/`, wired up in `app/layout.tsx`) and serves `app/~offline/page.tsx` when offline. The image-cache rule uses the user's configured Blossom server.

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
