"use client";

import { useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  User,
  LogIn,
  LogOut,
  Sun,
  Moon,
  Globe,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveUser } from "@/hooks/useActiveUser";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

/** nostr-login is driven by events dispatched on `document` (see its README). */
function launchNostrLogin(startScreen?: string) {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent("nlLaunch", { detail: startScreen ?? "" })
  );
}
function logoutNostr() {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new Event("nlLogout"));
}

const itemClass = cn(
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
  "text-sm font-medium text-on-surface-variant",
  "transition-colors duration-200 hover:bg-surface-high hover:text-on-surface"
);

/**
 * Mobile (< lg) account/settings menu. Consolidates login/profile/logout, the
 * theme toggle and the language picker behind a single hamburger button so the
 * narrow top bar stays uncluttered.
 */
export function MobileMenu() {
  const { t } = useTranslation();
  const activeUser = useActiveUser();
  const { theme, toggle } = useTheme();
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full",
          "text-on-surface-variant hover:text-on-surface hover:bg-surface-high",
          "transition-colors duration-200"
        )}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 mt-2 z-50 w-60 p-1.5",
            "rounded-2xl bg-surface border border-outline-variant/40",
            "shadow-[var(--shadow-overlay)] backdrop-blur-md"
          )}
        >
          {/* Account */}
          {activeUser ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  launchNostrLogin("switch-account");
                  setOpen(false);
                }}
                className={itemClass}
              >
                <User size={18} className="text-primary" />
                {t("navbar.profile", "Profile")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  logoutNostr();
                  setOpen(false);
                }}
                className={itemClass}
              >
                <LogOut size={18} />
                {t("logout", "Logout")}
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                launchNostrLogin("welcome");
                setOpen(false);
              }}
              className={itemClass}
            >
              <LogIn size={18} />
              {t("navbar.login.login", "Login")}
            </button>
          )}

          <div className="my-1.5 h-px bg-outline-variant/30" />

          {/* Theme */}
          <button
            type="button"
            role="menuitem"
            onClick={toggle}
            className={itemClass}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark"
              ? t("theme.light", "Light mode")
              : t("theme.dark", "Dark mode")}
          </button>

          <div className="my-1.5 h-px bg-outline-variant/30" />

          {/* Language */}
          <div className="flex items-center gap-2 px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            <Globe size={14} />
            {t("common.changeLanguage", "Language")}
          </div>
          {languages.map(({ code, label }) => {
            const active = code === current;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => setLanguage(code)}
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
