"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNdk } from "nostr-hooks";
import { nip19 } from "nostr-tools";
import { Loader2, Plus, Search, X } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";

export interface EntityRef {
  /** Coordinate `kind:pubkey:d` used as the calendar's `a` tag. */
  aTag: string;
  naddr: string;
  title: string;
}

interface Props {
  label: string;
  allowedKinds: number[];
  value: EntityRef[];
  onChange: (refs: EntityRef[]) => void;
  placeholder?: string;
  hint?: string;
}

function coordinateOf(event: NDKEvent): string | null {
  const d = event.tags.find((t) => t[0] === "d")?.[1];
  return d ? `${event.kind}:${event.pubkey}:${d}` : null;
}

function refFromEvent(event: NDKEvent): EntityRef | null {
  const aTag = coordinateOf(event);
  if (!aTag) return null;
  const d = event.tags.find((t) => t[0] === "d")?.[1] || "";
  let naddr = aTag;
  try {
    naddr = nip19.naddrEncode({
      kind: event.kind!,
      pubkey: event.pubkey,
      identifier: d,
    });
  } catch {
    /* fall back to the coordinate */
  }
  return { aTag, naddr, title: getEventMetadata(event).title || "Untitled" };
}

export function NostrEntityPicker({
  label,
  allowedKinds,
  value,
  onChange,
  placeholder,
  hint,
}: Props) {
  const { ndk } = useNdk();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recent events of the allowed kinds, fetched once and filtered client-side
  // (relay NIP-50 text search isn't universally supported).
  const poolRef = useRef<NDKEvent[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const add = useCallback(
    (ref: EntityRef) => {
      if (value.some((r) => r.aTag === ref.aTag)) return;
      onChange([...value, ref]);
      setQuery("");
      setResults([]);
      setError(null);
    },
    [value, onChange]
  );

  const tryResolveIdentifier = useCallback(
    async (raw: string): Promise<boolean> => {
      const token =
        raw.match(/naddr1[0-9a-z]+/i)?.[0] ??
        (/^\d+:[0-9a-f]{64}:.+$/i.test(raw.trim()) ? raw.trim() : null);
      if (!token || !ndk) return false;

      try {
        let filter;
        if (token.startsWith("naddr")) {
          const decoded = nip19.decode(token);
          if (decoded.type !== "naddr") return false;
          const d = decoded.data;
          if (!allowedKinds.includes(d.kind)) {
            setError(`That entity is kind ${d.kind}, not allowed here.`);
            return true;
          }
          filter = { kinds: [d.kind], authors: [d.pubkey], "#d": [d.identifier] };
        } else {
          const [kindStr, pubkey, ...rest] = token.split(":");
          const kind = parseInt(kindStr);
          if (!allowedKinds.includes(kind)) {
            setError(`That coordinate is kind ${kind}, not allowed here.`);
            return true;
          }
          filter = { kinds: [kind], authors: [pubkey], "#d": [rest.join(":")] };
        }
        const event = await ndk.fetchEvent(filter);
        if (!event) {
          setError("Couldn’t find that entity on the relays.");
          return true;
        }
        const ref = refFromEvent(event);
        if (ref) add(ref);
        return true;
      } catch {
        setError("That doesn’t look like a valid naddr or coordinate.");
        return true;
      }
    },
    [ndk, allowedKinds, add]
  );

  useEffect(() => {
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (!ndk) return;
      setLoading(true);
      try {
        // Paste-an-naddr / coordinate path short-circuits the text search.
        if (await tryResolveIdentifier(q)) return;

        if (!poolRef.current) {
          const found = await ndk.fetchEvents({
            kinds: allowedKinds as number[],
            limit: 200,
          });
          poolRef.current = Array.from(found.values()) as NDKEvent[];
        }
        const lower = q.toLowerCase();
        const matches: EntityRef[] = [];
        const seen = new Set<string>();
        for (const ev of poolRef.current) {
          const meta = getEventMetadata(ev);
          if (!(meta.title || "").toLowerCase().includes(lower)) continue;
          const ref = refFromEvent(ev);
          if (ref && !seen.has(ref.aTag)) {
            seen.add(ref.aTag);
            matches.push(ref);
          }
          if (matches.length >= 8) break;
        }
        setResults(matches);
      } catch (e) {
        console.error("Entity search failed", e);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, ndk, allowedKinds, tryResolveIdentifier]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-label-sm uppercase text-on-surface-variant">{label}</span>

      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] bg-surface-low border border-outline-variant/40 focus-within:border-primary transition-colors">
          <Search size={18} className="text-on-surface-variant flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder ?? "Search or paste naddr…"}
            className="flex-1 bg-transparent outline-none type-body-md text-on-surface placeholder:text-on-surface-variant/60"
          />
          {loading && (
            <Loader2 size={16} className="animate-spin text-on-surface-variant" />
          )}
        </div>

        {results.length > 0 && (
          <ul
            role="listbox"
            className={cn(
              "absolute z-20 top-full left-0 right-0 mt-1.5 py-1.5 max-h-72 overflow-y-auto",
              "bg-surface rounded-[var(--radius-md)] shadow-[var(--shadow-overlay)] border border-outline-variant/30"
            )}
          >
            {results.map((r) => (
              <li key={r.aTag}>
                <button
                  type="button"
                  onClick={() => add(r)}
                  className="w-full text-left px-4 py-2.5 type-body-sm text-on-surface hover:bg-surface-base transition-colors flex items-center gap-2"
                >
                  <Plus size={14} className="text-primary flex-shrink-0" />
                  <span className="truncate">{r.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <span className="type-body-sm text-error">{error}</span>}
      {hint && !error && (
        <span className="type-label-sm text-on-surface-variant opacity-70 normal-case">
          {hint}
        </span>
      )}

      {value.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {value.map((r) => (
            <div
              key={r.aTag}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-surface-high"
            >
              <span className="type-body-sm text-on-surface truncate">{r.title}</span>
              <button
                type="button"
                aria-label={`Remove ${r.title}`}
                onClick={() => onChange(value.filter((x) => x.aTag !== r.aTag))}
                className="flex items-center justify-center text-on-surface-variant hover:text-on-surface flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
