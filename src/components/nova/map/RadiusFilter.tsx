"use client";

import { cn } from "@/lib/utils";

const QUICK_KM = [1, 5, 10, 25, 50];

interface RadiusFilterProps {
  radiusKm: number | null;
  onChange: (km: number | null) => void;
  hasCenter: boolean;
}

/** Distance filter: quick-select chips + a fine-grained slider (1–100 km). */
export function RadiusFilter({ radiusKm, onChange, hasCenter }: RadiusFilterProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="type-label-sm uppercase text-on-surface-variant">
          Radius
        </span>
        <span className="text-xs font-semibold text-on-surface">
          {radiusKm == null ? "Any distance" : `${radiusKm} km`}
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <Chip active={radiusKm == null} onClick={() => onChange(null)}>
          Any
        </Chip>
        {QUICK_KM.map((km) => (
          <Chip key={km} active={radiusKm === km} onClick={() => onChange(km)}>
            {km} km
          </Chip>
        ))}
      </div>

      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={radiusKm ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Search radius in kilometers"
        className="w-full cursor-pointer accent-[var(--primary)]"
      />

      {!hasCenter && (
        <p className="text-[11px] leading-snug text-on-surface-variant/80">
          Search a place or tap the crosshair to filter events by distance.
        </p>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-base text-on-surface-variant hover:bg-surface-high"
      )}
    >
      {children}
    </button>
  );
}
