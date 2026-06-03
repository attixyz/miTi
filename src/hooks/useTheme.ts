"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "miti-theme";
const DEFAULT_THEME: Theme = "dark";
// Broadcast theme changes so every useTheme() instance stays in sync: each call
// has its own state, so without this a consumer mounted elsewhere (e.g. the map)
// would keep its mount-time theme when the menu toggle flips it.
const THEME_EVENT = "miti-theme-change";

function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  // Keep the nostr-login modal's light/dark in sync with the app theme.
  document.dispatchEvent(
    new CustomEvent("nlDarkMode", { detail: next === "dark" })
  );
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const resolved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? DEFAULT_THEME;
    setThemeState(resolved);
    applyTheme(resolved);

    const onThemeChange = (e: Event) => {
      setThemeState((e as CustomEvent<Theme>).detail);
    };
    window.addEventListener(THEME_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_EVENT, onThemeChange);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: next }));
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, setTheme, toggle };
}
