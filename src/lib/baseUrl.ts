/**
 * Base-URL resolution — the single source of truth for "where is this app
 * running" so no public-facing absolute URL has to hardcode a domain.
 *
 * Two flavors:
 *   - `getBaseUrlFromHeaders(headers)` for request-time code (route handlers,
 *     `generateMetadata`) that can read the incoming host.
 *   - `getBaseUrlFromEnv()` for static contexts (`layout.tsx` metadata) that
 *     are evaluated at module load, with no request to inspect.
 *
 * Priority (highest first):
 *   1. NEXT_PUBLIC_SITE_URL    — explicit canonical; set once a real domain
 *                                exists so SEO/OG URLs stay stable across hosts.
 *   2. x-forwarded-host/-proto — the public host behind a proxy (request-time
 *                                only). Preferred over `host`, which behind
 *                                Vercel's proxy can be an internal address.
 *   3. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL — injected for free on Vercel.
 *   4. localhost — last resort.
 *
 * Result: dev → localhost, free deploy → *.vercel.app, custom domain → the real
 * domain the moment DNS points at it — all without code changes, and one
 * optional env var (NEXT_PUBLIC_SITE_URL) for a stable canonical.
 */

/**
 * Namespace for ICS `UID`s. Deliberately a FIXED constant, never host-detected:
 * RFC 5545 UIDs must be globally unique and stable for the event's lifetime so a
 * re-download is treated as "update", not "duplicate". `event.id` already
 * provides uniqueness; this `@domain` is only a namespace. Auto-detecting it
 * would yield different UIDs from localhost / *.vercel.app / the real domain and
 * spawn duplicate events in subscribers' calendars. Do not change it casually.
 */
export const ICS_UID_DOMAIN = "miti";

/** Anything with a `.get()` — both `Headers` (Web API) and `next/headers`. */
type HeaderGetter = Pick<Headers, "get">;

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, "");

const isLocalHost = (host: string) =>
  host.startsWith("localhost") || host.startsWith("127.0.0.1");

/** Tier 1: explicit canonical. */
function fromExplicitEnv(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  return url ? stripTrailingSlash(url) : null;
}

/** Tier 2: the host the request actually hit (forwarded host wins over `host`). */
function fromForwardedHost(headers: HeaderGetter): string | null {
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (!host) return null;
  const proto =
    headers.get("x-forwarded-proto") || (isLocalHost(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** Tier 3: Vercel system env (stable prod domain, then per-deploy URL). */
function fromVercel(): string | null {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : null;
}

/** Tier 4: localhost, the last resort when nothing else resolves. */
function lastResort(): string {
  return `http://localhost:${process.env.PORT ?? "3000"}`;
}

/** Request-time resolver: pass the incoming headers (route handler or `await headers()`). */
export function getBaseUrlFromHeaders(headers: HeaderGetter): string {
  return (
    fromExplicitEnv() ?? fromForwardedHost(headers) ?? fromVercel() ?? lastResort()
  );
}

/** Static-context resolver: no request available (e.g. `layout.tsx` metadata). */
export function getBaseUrlFromEnv(): string {
  return fromExplicitEnv() ?? fromVercel() ?? lastResort();
}

/** Bare host (no protocol) for display, e.g. OG-image footer text. */
export function getDisplayHost(headers: HeaderGetter): string {
  return new URL(getBaseUrlFromHeaders(headers)).host;
}
