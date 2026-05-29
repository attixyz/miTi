"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { initI18n } from "@/lib/i18n";
import { useNdk } from "nostr-hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLanguageSync } from "@/hooks/useLanguageSync";
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

const RELAY_URLS = ["wss://relay.damus.io"];

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

    const init = async () => {
      const { default: NDKCacheDexie } = await import("@nostr-dev-kit/ndk-cache-dexie");
      const cacheAdapter = new NDKCacheDexie({ dbName: "meetstr-ndk" }) as any;

      if (typeof window !== "undefined" && window.nostr) {
        const { NDKNip07Signer: Signer } = await import("@nostr-dev-kit/ndk");
        const signer: NDKNip07Signer = new Signer();
        initNdkRef.current({ explicitRelayUrls: RELAY_URLS, signer, cacheAdapter });
      } else {
        initNdkRef.current({ explicitRelayUrls: RELAY_URLS, cacheAdapter });
      }
    };

    import("nostr-login")
      .then(async ({ init: initLogin }) => {
        initLogin({
          bunkers: "nsec.app,highlighter.com,amber.app",
          theme: "default",
          darkMode: false,
          perms: "sign_event:1,nip04_encrypt,nip04_decrypt",
          noBanner: true,
          methods: ["connect", "extension", "readOnly", "local"],
          onAuth: async () => {
            setTimeout(init, 200);
          },
        });
        await init();
      })
      .catch((err) => console.error("nostr-login failed to load", err));
  }, [isClient]);

  useEffect(() => {
    if (!ndk) return;
    ndk.connect();
  }, [ndk]);

  return <>{children}</>;
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
        <BaseProviderContent>{children}</BaseProviderContent>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
