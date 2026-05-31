// src/hooks/useLanguage.ts
"use client";

import { useTranslation } from "react-i18next";

export type LanguageCode = "en" | "de" | "es";

/** Languages we ship translations for, with their native labels. */
export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
];

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Current UI language + a setter that switches i18next and persists the choice.
 * Persists to `localStorage["language"]` (read back by `useLanguageSync`) and to
 * the `lang`/`i18next` cookies so SSR (middleware + generateMetadata) stays in
 * sync on the next load.
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const current = (i18n.language?.split("-")[0] ?? "en") as LanguageCode;

  function setLanguage(code: LanguageCode) {
    if (code === current) return;
    i18n.changeLanguage(code);
    if (typeof window !== "undefined") {
      localStorage.setItem("language", code);
      document.cookie = `lang=${code};path=/;max-age=${ONE_YEAR}`;
      document.cookie = `i18next=${code};path=/;max-age=${ONE_YEAR}`;
    }
  }

  return { current, setLanguage, languages: SUPPORTED_LANGUAGES };
}
