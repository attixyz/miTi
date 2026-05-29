"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Normalises each entry before it's added (e.g. strip a leading #). */
  transform?: (raw: string) => string;
}

export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  transform,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const value = (transform ? transform(raw) : raw).trim();
    if (!value || values.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-label-sm uppercase text-on-surface-variant">{label}</span>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-surface-low border border-outline-variant/40 focus-within:border-primary transition-colors">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-secondary-container/30 text-on-secondary-container type-body-sm"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="flex items-center justify-center rounded-full hover:bg-on-secondary-container/10"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={values.length ? "" : placeholder}
          className="flex-1 min-w-[8ch] bg-transparent outline-none type-body-md text-on-surface placeholder:text-on-surface-variant/60"
        />
      </div>
    </div>
  );
}
