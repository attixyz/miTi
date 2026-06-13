"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

/**
 * Full-screen cover viewer for the event detail hero. Wraps
 * yet-another-react-lightbox (single slide + Zoom plugin) so the cropped
 * `object-cover` hero can be opened at full resolution with free zoom — pinch
 * + double-tap + drag-pan on touch, wheel-at-cursor + drag on desktop.
 *
 * Dismissal: besides the floating Back button (top-right, surface-coloured to
 * match the nav bar), backdrop tap, and ESC, opening pushes a history entry so
 * the phone/browser Back gesture closes the overlay instead of leaving the page
 * — without adding a route. The entry is balanced on close so we never leave a
 * dangling history state behind.
 */
export function NovaCoverLightbox({
  open,
  close,
  src,
  alt,
}: {
  open: boolean;
  close: () => void;
  src: string;
  alt: string;
}) {
  // Keep the latest close handler reachable from the popstate listener without
  // re-running the history effect on every render.
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    // Browser Back should dismiss the overlay; consume our own entry.
    let consumedByBack = false;
    window.history.pushState({ mitiLightbox: true }, "");

    const onPop = () => {
      consumedByBack = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed via Back button / ESC / backdrop — pop the entry we pushed so
      // history stays balanced. If Back already popped it, do nothing.
      if (!consumedByBack) window.history.back();
    };
  }, [open]);

  return (
    <Lightbox
      open={open}
      close={close}
      slides={[{ src, alt }]}
      plugins={[Zoom]}
      carousel={{ finite: true }}
      controller={{ closeOnBackdropClick: true }}
      animation={{ fade: 200 }}
      zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true, doubleTapDelay: 250 }}
      styles={{ container: { backgroundColor: "rgba(0,0,0,0.92)" } }}
      render={{
        buttonPrev: () => null,
        buttonNext: () => null,
        // Replace the default ✕ with a surface-coloured floating Back pill.
        buttonClose: () => (
          <button
            type="button"
            aria-label="Close image"
            onClick={close}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-surface/80 backdrop-blur-md text-on-surface shadow-lg transition-colors hover:bg-surface active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
        ),
      }}
    />
  );
}

export default NovaCoverLightbox;
