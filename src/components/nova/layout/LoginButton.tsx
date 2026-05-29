"use client";

import { LogIn, User } from "lucide-react";
import { useActiveUser } from "@/hooks/useActiveUser";
import { cn } from "@/lib/utils";

export function LoginButton({ className }: { className?: string }) {
  const activeUser = useActiveUser();

  function handleClick() {
    if (typeof window !== "undefined") {
      if (activeUser) {
        // nostr-login handles the profile/logout modal
        window.dispatchEvent(new CustomEvent("nlLaunch", { detail: "profile" }));
      } else {
        window.dispatchEvent(new CustomEvent("nlLaunch", {}));
      }
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label={activeUser ? "Profile" : "Login"}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full",
        "text-on-surface-variant hover:text-on-surface hover:bg-surface-high",
        "transition-colors duration-200",
        className
      )}
    >
      {activeUser ? (
        <User size={20} className="text-primary" />
      ) : (
        <LogIn size={20} />
      )}
    </button>
  );
}
