"use client";

import type { Map as LeafletMap } from "leaflet";
import { Plus, Minus, Crosshair, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapControlsProps {
  map: LeafletMap | null;
  onLocate: () => void;
  locating: boolean;
}

/** Floating bottom-right cluster: zoom in/out + browser geolocation crosshair. */
export function MapControls({ map, onLocate, locating }: MapControlsProps) {
  return (
    <div className="absolute right-3 md:right-6 bottom-28 md:bottom-6 z-[1100] flex flex-col gap-2">
      <ControlButton label="Zoom in" onClick={() => map?.zoomIn()}>
        <Plus size={18} />
      </ControlButton>
      <ControlButton label="Zoom out" onClick={() => map?.zoomOut()}>
        <Minus size={18} />
      </ControlButton>
      <ControlButton label="Use my location" onClick={onLocate} className="mt-1">
        {locating ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Crosshair size={18} />
        )}
      </ControlButton>
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full",
        "bg-surface border border-outline-variant/50 text-on-surface",
        "shadow-[var(--shadow-overlay)] hover:bg-surface-high transition-colors active:scale-95",
        className
      )}
    >
      {children}
    </button>
  );
}
