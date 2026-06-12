"use client";

// Local taste-pipeline settings: the element-selection checkboxes and the
// `debug` flag. Both live in localStorage for now; the debug flag (and later
// the element selection) moves into the synced `miti-setting` doc in Phase 4
// (user-preferences.md). Same broadcast pattern as useTheme: every hook
// instance stays in sync via a window CustomEvent.

import { useEffect, useState } from "react";
import { DEFAULT_ELEMENT_SETTINGS } from "./tokenizer";
import type { TasteElementSettings } from "./tokenizer";

const ELEMENTS_KEY = "miti-taste-elements";
const ELEMENTS_EVENT = "miti-taste-elements-change";
const DEBUG_KEY = "miti-debug";
const DEBUG_EVENT = "miti-debug-change";

export function getTasteElementSettings(): TasteElementSettings {
  if (typeof window === "undefined") return DEFAULT_ELEMENT_SETTINGS;
  try {
    const raw = localStorage.getItem(ELEMENTS_KEY);
    if (!raw) return DEFAULT_ELEMENT_SETTINGS;
    return { ...DEFAULT_ELEMENT_SETTINGS, ...(JSON.parse(raw) as Partial<TasteElementSettings>) };
  } catch {
    return DEFAULT_ELEMENT_SETTINGS;
  }
}

/**
 * Persist a new element selection. The caller (settings page) must follow up
 * with `requestFullReindex()`: changing the selection changes which words
 * exist in the whole corpus. A forgotten reindex self-heals — the worker
 * detects the fingerprint mismatch on the next batch and asks for one.
 */
export function setTasteElementSettings(next: TasteElementSettings) {
  localStorage.setItem(ELEMENTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<TasteElementSettings>(ELEMENTS_EVENT, { detail: next }));
}

export function useTasteElementSettings() {
  const [settings, setSettingsState] = useState<TasteElementSettings>(DEFAULT_ELEMENT_SETTINGS);

  useEffect(() => {
    setSettingsState(getTasteElementSettings());
    const onChange = (e: Event) => {
      setSettingsState((e as CustomEvent<TasteElementSettings>).detail);
    };
    window.addEventListener(ELEMENTS_EVENT, onChange);
    return () => window.removeEventListener(ELEMENTS_EVENT, onChange);
  }, []);

  return settings;
}

export function getDebugFlag(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEBUG_KEY) === "true";
}

export function setDebugFlag(on: boolean) {
  localStorage.setItem(DEBUG_KEY, String(on));
  window.dispatchEvent(new CustomEvent<boolean>(DEBUG_EVENT, { detail: on }));
}

/** `ready` is false until the client value has been read — render nothing before it. */
export function useDebugFlag() {
  const [debug, setDebugState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDebugState(getDebugFlag());
    setReady(true);
    const onChange = (e: Event) => setDebugState((e as CustomEvent<boolean>).detail);
    window.addEventListener(DEBUG_EVENT, onChange);
    return () => window.removeEventListener(DEBUG_EVENT, onChange);
  }, []);

  return { debug, ready };
}
