"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "miti-theme";
const DEFAULT_THEME: Theme = "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const resolved = stored ?? DEFAULT_THEME;
    setThemeState(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
    // Keep the nostr-login modal's light/dark in sync with the app theme.
    document.dispatchEvent(
      new CustomEvent("nlDarkMode", { detail: next === "dark" })
    );
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, setTheme, toggle };
}
