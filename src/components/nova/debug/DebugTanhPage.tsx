"use client";

import { useMemo } from "react";
import { squash, DEFAULT_K } from "@/lib/taste/scoring";
import { useK, setK } from "@/lib/taste/tunables";
import { ACTION_POINTS } from "@/lib/taste/points";
import { DebugGate } from "./DebugGate";

/**
 * /debug/tanh-function — adjust `k` (the slope of `squash`) and preview the
 * curve (like-dislike.md, "UI and routes"). Changing k invalidates every
 * cached event score (setK does it), so routes re-rank on the next render.
 */
export function DebugTanhPage() {
  return (
    <DebugGate what="tune the squash function">
      <TanhTuner />
    </DebugGate>
  );
}

/** Raw word-score axis: a bit past the strongest single action (rsvp_yes). */
const X_MAX = 400;
const WIDTH = 640;
const HEIGHT = 280;
const PAD = 24;

function toX(score: number): number {
  return PAD + ((score + X_MAX) / (2 * X_MAX)) * (WIDTH - 2 * PAD);
}

function toY(squashed: number): number {
  return PAD + ((1 - squashed) / 2) * (HEIGHT - 2 * PAD);
}

function TanhTuner() {
  const k = useK();

  const curve = useMemo(() => {
    const points: string[] = [];
    for (let score = -X_MAX; score <= X_MAX; score += 5) {
      points.push(`${toX(score).toFixed(1)},${toY(squash(score, k)).toFixed(1)}`);
    }
    return points.join(" ");
  }, [k]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:py-8">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-on-surface">
        Squash function
      </h1>
      <p className="mb-6 text-xs text-on-surface-variant">
        squash(score) = tanh(k · score) maps a word&apos;s unbounded raw
        like_score into (−1, 1). Changing k invalidates every cached event
        score.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-3 text-sm text-on-surface">
          <span className="font-semibold">k</span>
          <input
            type="range"
            min={0.001}
            max={0.1}
            step={0.001}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="w-56 accent-[var(--primary)]"
          />
          <input
            type="number"
            min={0.001}
            step={0.001}
            value={k}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next) && next > 0) setK(next);
            }}
            className="w-24 rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-sm tabular-nums text-on-surface focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
        <button
          type="button"
          onClick={() => setK(DEFAULT_K)}
          disabled={k === DEFAULT_K}
          className="rounded-full border border-outline-variant/40 px-4 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-high disabled:cursor-default disabled:opacity-50"
        >
          Reset to {DEFAULT_K}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface/80 p-2">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[480px]"
          role="img"
          aria-label="Squash curve preview"
        >
          {/* Asymptotes and axes */}
          <line x1={PAD} y1={toY(1)} x2={WIDTH - PAD} y2={toY(1)} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4 4" />
          <line x1={PAD} y1={toY(-1)} x2={WIDTH - PAD} y2={toY(-1)} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4 4" />
          <line x1={PAD} y1={toY(0)} x2={WIDTH - PAD} y2={toY(0)} stroke="currentColor" strokeOpacity={0.3} />
          <line x1={toX(0)} y1={PAD} x2={toX(0)} y2={HEIGHT - PAD} stroke="currentColor" strokeOpacity={0.3} />
          <text x={WIDTH - PAD} y={toY(1) - 4} textAnchor="end" className="fill-current text-[10px] opacity-50">+1</text>
          <text x={WIDTH - PAD} y={toY(-1) + 12} textAnchor="end" className="fill-current text-[10px] opacity-50">−1</text>

          {/* Where each single action would land a previously-neutral word */}
          {Object.entries(ACTION_POINTS).map(([action, points]) => (
            <g key={action}>
              <circle
                cx={toX(points)}
                cy={toY(squash(points, k))}
                r={3}
                className="fill-[var(--primary)]"
              />
              <text
                x={toX(points)}
                y={toY(squash(points, k)) + (points < 0 ? 14 : -8)}
                textAnchor="middle"
                className="fill-current text-[9px] opacity-60"
              >
                {action} ({points})
              </text>
            </g>
          ))}

          <polyline
            points={curve}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
          />
        </svg>
      </div>

      <p className="mt-3 text-xs text-on-surface-variant/70">
        Dots mark where one action&apos;s full point value would put a word that
        had no other feedback (the real split divides points across all of an
        event&apos;s words by weight · idf, so per-word movements are smaller).
      </p>
    </div>
  );
}
