"use client";

import { SUGGESTED_DEFAULTS } from "@/lib/taste/scoring";
import type { SuggestedKnobs } from "@/lib/taste/scoring";
import { useSuggestedKnobs, setSuggestedKnobs } from "@/lib/taste/tunables";
import { DebugGate } from "./DebugGate";

/**
 * /debug/suggested — adjust the five suggested_score knobs (like-dislike.md,
 * "Combined score for /suggested") without a release. The knobs only enter at
 * /suggested render time, so no score invalidation is involved.
 */
export function DebugSuggestedPage() {
  return (
    <DebugGate what="tune the suggested ranking">
      <SuggestedTuner />
    </DebugGate>
  );
}

const KNOBS: {
  key: keyof SuggestedKnobs;
  label: string;
  description: string;
  min: number;
  step: number;
}[] = [
  {
    key: "wTaste",
    label: "W_TASTE",
    description:
      "Taste exponent. Larger = bad taste punishes the score harder. Only the ratios between the three exponents matter.",
    min: 0,
    step: 0.1,
  },
  {
    key: "wProx",
    label: "W_PROX",
    description: "Proximity exponent. Larger = far events sink faster.",
    min: 0,
    step: 0.1,
  },
  {
    key: "wSoon",
    label: "W_SOON",
    description: "Soonness exponent. Larger = distant dates sink faster.",
    min: 0,
    step: 0.1,
  },
  {
    key: "d0Km",
    label: "D0 (km)",
    description: "Half-score distance: an event this many km away scores proximity 0.5.",
    min: 1,
    step: 1,
  },
  {
    key: "t0Days",
    label: "T0 (days)",
    description: "Half-score horizon: an event this many days out scores soonness 0.5.",
    min: 1,
    step: 1,
  },
];

function SuggestedTuner() {
  const knobs = useSuggestedKnobs();
  const isDefault = KNOBS.every(({ key }) => knobs[key] === SUGGESTED_DEFAULTS[key]);

  const update = (key: keyof SuggestedKnobs, raw: string, min: number) => {
    const next = Number(raw);
    if (Number.isFinite(next) && next >= min) {
      setSuggestedKnobs({ ...knobs, [key]: next });
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:py-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">
          Suggested ranking
        </h1>
        <button
          type="button"
          onClick={() => setSuggestedKnobs(SUGGESTED_DEFAULTS)}
          disabled={isDefault}
          className="rounded-full border border-outline-variant/40 px-4 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-high disabled:cursor-default disabled:opacity-50"
        >
          Reset defaults
        </button>
      </div>
      <p className="mb-6 text-xs text-on-surface-variant">
        suggested_score = taste^{knobs.wTaste} · proximity^{knobs.wProx} ·
        soonness^{knobs.wSoon} — each factor normalized into (0, 1] first, so a
        near-zero factor sinks the whole product. Changes apply on the next{" "}
        /suggested render.
      </p>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface/80">
        {KNOBS.map(({ key, label, description, min, step }, i) => (
          <div
            key={key}
            className={
              "flex items-center gap-4 px-4 py-3" +
              (i > 0 ? " border-t border-outline-variant/20" : "")
            }
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-on-surface">{label}</div>
              <div className="text-xs text-on-surface-variant">{description}</div>
            </div>
            <input
              type="number"
              min={min}
              step={step}
              value={knobs[key]}
              onChange={(e) => update(key, e.target.value, min)}
              className="w-24 shrink-0 rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-right text-sm tabular-nums text-on-surface focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
