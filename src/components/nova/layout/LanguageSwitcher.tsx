"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

/**
 * World-icon button that opens a small dropdown of available UI languages.
 * Used standalone in the desktop sidebar; the mobile menu renders the same
 * language list inline (see MobileMenu).
 */
export function LanguageSwitcher({
  className,
  menuClassName = "right-0 mt-2",
}: {
  className?: string;
  /** Positioning for the dropdown panel (override to open upward, etc.). */
  menuClassName?: string;
}) {
  const { t } = useTranslation();
  const { current, setLanguage, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("common.changeLanguage", "Change language")}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full",
          "text-on-surface-variant hover:text-on-surface hover:bg-surface-high",
          "transition-colors duration-200"
        )}
      >
        <Globe size={20} />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 min-w-[160px] p-1",
            "rounded-xl bg-surface border border-outline-variant/40",
            "shadow-[var(--shadow-overlay)] backdrop-blur-md",
            menuClassName
          )}
        >
          {languages.map(({ code, label }) => {
            const active = code === current;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2",
                  "text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
                )}
              >
                {label}
                {active && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
