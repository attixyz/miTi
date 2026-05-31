"use client";

import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveUser } from "@/hooks/useActiveUser";
import { cn } from "@/lib/utils";

/** Icon button that logs the current user out. Renders nothing when logged out. */
export function LogoutButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const activeUser = useActiveUser();

  if (!activeUser) return null;

  function handleClick() {
    if (typeof document === "undefined") return;
    // nostr-login listens for nlLogout on `document`.
    document.dispatchEvent(new Event("nlLogout"));
  }

  return (
    <button
      onClick={handleClick}
      aria-label={t("logout", "Logout")}
      title={t("logout", "Logout")}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full",
        "text-on-surface-variant hover:text-on-surface hover:bg-surface-high",
        "transition-colors duration-200",
        className
      )}
    >
      <LogOut size={20} />
    </button>
  );
}
