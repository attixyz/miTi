"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickedLocation {
  label: string;
  lat: number;
  lon: number;
}

interface ProviderResult {
  x: number; // longitude
  y: number; // latitude
  label: string;
}

interface LocationSearchInputProps {
  value: PickedLocation | null;
  onChange: (value: PickedLocation | null) => void;
}

export function LocationSearchInput({ value, onChange }: LocationSearchInputProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // leaflet-geosearch touches `window`, so the provider is created lazily in
  // the browser and reused across searches.
  const providerRef = useRef<{ search: (o: { query: string }) => Promise<ProviderResult[]> } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function getProvider() {
    if (providerRef.current) return providerRef.current;
    const { OpenStreetMapProvider } = await import("leaflet-geosearch");
    // accept-language "en" keeps saved location strings consistent across
    // users (see issue #6 — local-language results break text matching).
    providerRef.current = new OpenStreetMapProvider({
      params: { "accept-language": "en" },
    }) as unknown as typeof providerRef.current;
    return providerRef.current!;
  }

  function onInput(next: string) {
    setQuery(next);
    if (value) onChange(null); // typing invalidates a previous selection
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setOpen(true);
      try {
        const provider = await getProvider();
        const found = await provider.search({ query: next });
        setResults(found.slice(0, 6));
      } catch (err) {
        console.error("Location search failed", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  function pick(r: ProviderResult) {
    onChange({ label: r.label, lat: r.y, lon: r.x });
    setQuery(r.label);
    setResults([]);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      <span className="type-label-sm uppercase text-on-surface-variant">Location</span>

      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] bg-surface-low border border-outline-variant/40 focus-within:border-primary transition-colors">
          <MapPin size={18} className="text-primary flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => onInput(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Search for a place or address…"
            className="flex-1 bg-transparent outline-none type-body-md text-on-surface placeholder:text-on-surface-variant/60"
          />
          {loading && <Loader2 size={16} className="animate-spin text-on-surface-variant" />}
          {query && !loading && (
            <button
              type="button"
              aria-label="Clear location"
              onClick={clear}
              className="flex items-center justify-center text-on-surface-variant hover:text-on-surface"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {open && results.length > 0 && (
          <ul
            role="listbox"
            className={cn(
              "absolute z-20 top-full left-0 right-0 mt-1.5 py-1.5 max-h-72 overflow-y-auto",
              "bg-surface rounded-[var(--radius-md)] shadow-[var(--shadow-overlay)] border border-outline-variant/30"
            )}
          >
            {results.map((r) => (
              <li key={`${r.label}-${r.x}-${r.y}`}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="w-full text-left px-4 py-2.5 type-body-sm text-on-surface hover:bg-surface-base transition-colors flex items-start gap-2"
                >
                  <MapPin size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <span>{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
