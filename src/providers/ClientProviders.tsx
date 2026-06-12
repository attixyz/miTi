"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { initI18n } from "@/lib/i18n";
import { useNdk } from "nostr-hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { FiltersProvider } from "@/providers/FiltersContext";
import { SettingsSyncBridge } from "@/providers/SettingsSyncBridge";
import { getEffectiveRelays } from "@/lib/prefs/settingsStore";
import type { NDKNip07Signer } from "@nostr-dev-kit/ndk";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (error && typeof error === "object" && "status" in error) {
          if ((error as { status: number }).status === 404 || (error as { status: number }).status === 401) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: { retry: 1 },
  },
});

function BaseProviderContent({ children }: { children: ReactNode }) {
  const { initNdk, ndk } = useNdk();
  const [isClient, setIsClient] = useState(false);
  const initialized = useRef(false);
  // Capture initNdk in a ref so the effect below doesn't re-fire when the
  // function reference changes on re-renders (nostr-hooks returns a new ref
  // each render, which would cause an infinite setState loop).
  const initNdkRef = useRef(initNdk);
  useEffect(() => { initNdkRef.current = initNdk; }, [initNdk]);

  useLanguageSync();

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isClient || initialized.current) return;
    initialized.current = true;

    // Attach the NIP-07 signer only when the user is actually logged in. A
    // signer-less NDK never calls window.nostr, so a logged-out session can't
    // trip nostr-login's "call window.nostr ⇒ auto-launch the modal" behaviour
    // (the cause of the modal popping up repeatedly after logout).
    const init = async (withSigner: boolean) => {
      const { default: NDKCacheDexie } = await import("@nostr-dev-kit/ndk-cache-dexie");
      const cacheAdapter = new NDKCacheDexie({ dbName: "miti-ndk" }) as any;

      // The user's saved relay list (synced via miti-setting), falling back
      // to DEFAULT_RELAYS. The settings sync engine reconfigures the pool in
      // place if a newer doc arrives after login.
      const relays = getEffectiveRelays();

      if (withSigner && typeof window !== "undefined" && window.nostr) {
        const { NDKNip07Signer: Signer } = await import("@nostr-dev-kit/ndk");
        const signer: NDKNip07Signer = new Signer();
        initNdkRef.current({ explicitRelayUrls: relays, signer, cacheAdapter });
      } else {
        initNdkRef.current({ explicitRelayUrls: relays, cacheAdapter });
      }
    };

    import("nostr-login")
      .then(async ({ init: initLogin }) => {
        // Match the modal to our current theme (purple accent, light/dark).
        const prefersDark =
          (localStorage.getItem("miti-theme") ?? "dark") === "dark";
        initLogin({
          bunkers: "nsec.app,highlighter.com,amber.app",
          theme: "default",
          darkMode: prefersDark,
          // NIP-78 settings sync encrypts to self with NIP-44 and signs kind
          // 30078 (user-preferences.md, "Encryption"). NIP-04 dropped: the
          // spec rejected it (deprecated, weaker) and nothing else used it.
          // Existing bunker users may see a one-time re-consent prompt.
          perms: "sign_event:30078,nip44_encrypt,nip44_decrypt",
          noBanner: true,
          methods: ["connect", "extension", "readOnly", "local"],
          onAuth: async (_npub, options) => {
            // Re-init with a signer on login/signup, without one on logout.
            setTimeout(() => init(options?.type !== "logout"), 200);
          },
        });
        // Start signer-less; onAuth('login') re-inits with a signer once a
        // stored session is restored or the user logs in explicitly.
        await init(false);
      })
      .catch((err) => console.error("nostr-login failed to load", err));
  }, [isClient]);

  useEffect(() => {
    if (!ndk) return;
    ndk.connect();
  }, [ndk]);

  return (
    <>
      <SettingsSyncBridge />
      {children}
    </>
  );
}

export default function ClientProviders({
  children,
  serverLang,
}: {
  children: ReactNode;
  serverLang: string;
}) {
  const [i18nInstance] = useState(() => initI18n(serverLang));

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18nInstance}>
        <FiltersProvider>
          <BaseProviderContent>{children}</BaseProviderContent>
        </FiltersProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
