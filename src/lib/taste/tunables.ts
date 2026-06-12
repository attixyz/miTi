"use client";

// Debug-tunable parameters (like-dislike.md, "UI and routes"): the squash
// slope `k` (/debug/tanh-function) and the five suggested_score knobs
// (/debug/suggested). localStorage-backed with the same window-CustomEvent
// broadcast pattern as settings.ts, so every hook instance stays in sync.

import { useEffect, useState } from "react";
import { DEFAULT_K, SUGGESTED_DEFAULTS } from "./scoring";
import type { SuggestedKnobs } from "./scoring";
import { getTasteDb, invalidateEventScores } from "./db";

const K_KEY = "miti-taste-k";
const K_EVENT = "miti-taste-k-change";
const SUGGESTED_KEY = "miti-taste-suggested-knobs";
const SUGGESTED_EVENT = "miti-taste-suggested-knobs-change";

export function getK(): number {
  if (typeof window === "undefined") return DEFAULT_K;
  const parsed = Number(localStorage.getItem(K_KEY));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_K;
}

/** Changing the squash slope changes every event's score → invalidate them. */
export function setK(k: number) {
  localStorage.setItem(K_KEY, String(k));
  window.dispatchEvent(new CustomEvent<number>(K_EVENT, { detail: k }));
  const db = getTasteDb();
  if (db) void invalidateEventScores(db);
}

export function useK(): number {
  const [k, setKState] = useState(DEFAULT_K);
  useEffect(() => {
    setKState(getK());
    const onChange = (e: Event) => setKState((e as CustomEvent<number>).detail);
    window.addEventListener(K_EVENT, onChange);
    return () => window.removeEventListener(K_EVENT, onChange);
  }, []);
  return k;
}

export function getSuggestedKnobs(): SuggestedKnobs {
  if (typeof window === "undefined") return SUGGESTED_DEFAULTS;
  try {
    const raw = localStorage.getItem(SUGGESTED_KEY);
    if (!raw) return SUGGESTED_DEFAULTS;
    return { ...SUGGESTED_DEFAULTS, ...(JSON.parse(raw) as Partial<SuggestedKnobs>) };
  } catch {
    return SUGGESTED_DEFAULTS;
  }
}

/** No score invalidation needed: the knobs only enter at /suggested render. */
export function setSuggestedKnobs(next: SuggestedKnobs) {
  localStorage.setItem(SUGGESTED_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<SuggestedKnobs>(SUGGESTED_EVENT, { detail: next }));
}

export function useSuggestedKnobs(): SuggestedKnobs {
  const [knobs, setKnobsState] = useState<SuggestedKnobs>(SUGGESTED_DEFAULTS);
  useEffect(() => {
    setKnobsState(getSuggestedKnobs());
    const onChange = (e: Event) =>
      setKnobsState((e as CustomEvent<SuggestedKnobs>).detail);
    window.addEventListener(SUGGESTED_EVENT, onChange);
    return () => window.removeEventListener(SUGGESTED_EVENT, onChange);
  }, []);
  return knobs;
}
