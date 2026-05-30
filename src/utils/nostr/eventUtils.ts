// src/utils/nostr/eventUtils.ts
import type { NDKEvent } from "@nostr-dev-kit/ndk";

// Cache for processed metadata to avoid recomputing
const metadataCache = new Map<string, any>();

export const getEventMetadata = (event: NDKEvent) => {
  // Use event ID as cache key
  const cacheKey = event.id;
  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey);
  }

  // Pre-process tags into a map for faster lookups
  const tagMap = new Map<string, string[]>();
  event.tags.forEach((tag) => {
    const [key, ...values] = tag;
    if (!tagMap.has(key)) {
      tagMap.set(key, []);
    }
    tagMap.get(key)!.push(...values);
  });

  const getTagValue = (tagName: string) => tagMap.get(tagName)?.[0];
  const getTagValues = (tagName: string) => tagMap.get(tagName) || [];

  const metadata = {
    title: getTagValue("title") || getTagValue("name"),
    start: getTagValue("start"),
    end: getTagValue("end"),
    start_tzid: getTagValue("start_tzid"),
    end_tzid: getTagValue("end_tzid"),
    // Legacy combined field — kept for backward compatibility (calendars, OG,
    // ICS, search all read `summary`). Do not change its fallback behaviour.
    summary: getTagValue("summary") || getTagValue("description"),
    // NIP-52 fields kept separate for correct display:
    // short_description → the `summary` tag only (secondary, short blurb)
    shortDescription: getTagValue("summary"),
    // the `description` tag — fallback source for the main body text
    description: getTagValue("description"),
    // canonical full description per NIP-52 → `event.content`
    content: event.content || "",
    // Prefer the NIP-52 `image` tag; fall back to a legacy `cover` tag.
    image: getTagValue("image") || getTagValue("cover"),
    location: getTagValue("location"),
    geohash: getTagValue("g"),
    participants: getTagValues("p"),
    labels: [...getTagValues("l"), ...getTagValues("L")],
    hashtags: getTagValues("t"),
    references: getTagValues("r"),
    uuid: getTagValue("d"),
  };

  // Cache the result
  metadataCache.set(cacheKey, metadata);

  // Limit cache size to prevent memory leaks
  if (metadataCache.size > 1000) {
    const firstKey = metadataCache.keys().next().value;
    if (firstKey) {
      metadataCache.delete(firstKey);
    }
  }

  return metadata;
};
