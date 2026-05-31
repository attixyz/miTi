// src/lib/ndkClient.ts
import NDK from "@nostr-dev-kit/ndk";
import { DEFAULT_RELAYS } from "@/lib/relays";

let ndkInstance: NDK | null = null;

export function getNdk(): NDK {
  if (!ndkInstance) {
    ndkInstance = new NDK({
      explicitRelayUrls: [...DEFAULT_RELAYS],
    });
    ndkInstance.connect().catch(console.error);
  }
  return ndkInstance;
}
