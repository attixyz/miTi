"use client";

import { cn } from "@/lib/utils";
import {
  useTasteElementSettings,
  setTasteElementSettings,
  useDebugFlag,
} from "@/lib/taste/settings";
import { updateSettings } from "@/lib/prefs/settingsStore";
import { requestFullReindex } from "@/lib/taste/indexer";
import type { TasteElementSettings } from "@/lib/taste/tokenizer";

const ELEMENT_OPTIONS: {
  key: keyof TasteElementSettings;
  label: string;
  description: string;
}[] = [
  {
    key: "mainText",
    label: "Main text",
    description: "Include the full event description in the analysis.",
  },
  {
    key: "summary",
    label: "Short description",
    description: "Include the first 140 characters of the summary.",
  },
  {
    key: "location",
    label: "Location",
    description: "Include the event's location text.",
  },
];

/**
 * App settings. The "Taste analysis" element checkboxes are a GLOBAL pipeline
 * setting (like-dislike.md, "Element selection"): flipping one changes which
 * words exist in the whole corpus, so it triggers a full reindex in the
 * taste Web Worker.
 */
export function NovaSettingsPage() {
  const elements = useTasteElementSettings();
  const { debug, ready } = useDebugFlag();

  function toggleElement(key: keyof TasteElementSettings) {
    setTasteElementSettings({ ...elements, [key]: !elements[key] });
    requestFullReindex();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-on-surface">Settings</h1>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Taste analysis
          </h2>
          <div className="overflow-hidden rounded-[6px] border border-outline-variant/30 bg-surface/80 backdrop-blur-md">
            <p className="px-4 pb-1 pt-3 text-xs leading-relaxed text-on-surface-variant">
              Events are analyzed on this device to learn your taste — nothing
              leaves your browser. Title and tags are always included; choose
              what else counts. Changing this re-analyzes all events.
            </p>
            {ELEMENT_OPTIONS.map((option, i) => (
              <label
                key={option.key}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-outline-variant/20",
                  "transition-colors duration-200 hover:bg-surface-high"
                )}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-on-surface">{option.label}</div>
                  <div className="text-xs text-on-surface-variant">{option.description}</div>
                </div>
                <input
                  type="checkbox"
                  checked={elements[option.key]}
                  onChange={() => toggleElement(option.key)}
                  className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--primary)]"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Developer
          </h2>
          <div className="overflow-hidden rounded-[6px] border border-outline-variant/30 bg-surface/80 backdrop-blur-md">
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface-high">
              <div className="flex-1">
                <div className="text-sm font-medium text-on-surface">Debug mode</div>
                <div className="text-xs text-on-surface-variant">
                  Unlocks the /debug pages for inspecting the taste data.
                </div>
              </div>
              <input
                type="checkbox"
                checked={ready && debug}
                // Through the synced settings store, so the flag travels in
                // the miti-setting doc (user-preferences.md) — useDebugFlag
                // still re-renders via the same broadcast as before.
                onChange={(e) => updateSettings({ debug: e.target.checked })}
                className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--primary)]"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
