"use client";

// Glue between React session state and the two sync engines (miti-setting,
// miti-likes). Renders nothing; (re)starts the engines whenever a
// signing-capable session and an NDK instance are both present, stops them on
// logout or NDK re-init.

import { useEffect, useState } from "react";
import { useNdk } from "nostr-hooks";
import { useActiveUser } from "@/hooks/useActiveUser";
import { startSettingsSync, stopSettingsSync } from "@/lib/prefs/settingsSync";
import { startLikesSync, stopLikesSync } from "@/lib/prefs/likesSync";

export function SettingsSyncBridge() {
  const { ndk } = useNdk();
  const user = useActiveUser();
  // Read-only sessions can't encrypt/decrypt, so sync stays off there
  // (user-preferences.md, "Encryption"). nostr-login reports the method in
  // the nlAuth detail; this listener is registered before nostr-login is
  // even loaded (ClientProviders inits it in a later effect), so no event
  // can be missed.
  const [canSign, setCanSign] = useState(false);

  useEffect(() => {
    const onAuth = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string; method?: string }>).detail;
      setCanSign(detail?.type !== "logout" && detail?.method !== "readOnly");
    };
    const onLogout = () => setCanSign(false);
    document.addEventListener("nlAuth", onAuth);
    document.addEventListener("nlLogout", onLogout);
    return () => {
      document.removeEventListener("nlAuth", onAuth);
      document.removeEventListener("nlLogout", onLogout);
    };
  }, []);

  useEffect(() => {
    if (!ndk || !user || !canSign) return;
    startSettingsSync(ndk, user.pubkey);
    startLikesSync(ndk, user.pubkey);
    return () => {
      stopLikesSync();
      stopSettingsSync();
    };
  }, [ndk, user, canSign]);

  return null;
}
