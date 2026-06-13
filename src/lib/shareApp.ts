/**
 * "Recommend this app" — open the device's native share sheet with a link to
 * miTi. The shared URL is the app's base domain (`window.location.origin`), the
 * same origin the /event share builds its full URL on, so the recommendation
 * always points at whatever host the app is actually running on (localhost,
 * *.vercel.app or the custom domain).
 *
 * Falls back to copying the link to the clipboard where the Web Share API is
 * unavailable (most desktop browsers). User-cancelled shares are swallowed.
 */
export async function shareApp(): Promise<void> {
  if (typeof window === "undefined") return;
  const url = window.location.origin;
  const shareData: ShareData = {
    title: "miTi",
    text: "Check out miTi — find and create events on Nostr.",
    url,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch {
      /* user dismissed the sheet or sharing failed — nothing to do */
    }
  } else {
    navigator.clipboard?.writeText(url).catch(() => {});
  }
}
