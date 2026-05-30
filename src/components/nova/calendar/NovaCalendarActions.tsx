"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { cn } from "@/lib/utils";
import { encodeEventToNaddr } from "@/utils/nostr/nostrUtils";
import { useCalendarMutations } from "./useCalendarMutations";

/** Owner-only edit/delete menu for a calendar. */
export function NovaCalendarActions({ calendar }: { calendar: NDKEvent }) {
  const router = useRouter();
  const { deleteCalendar, publishing } = useCalendarMutations();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function edit() {
    setOpen(false);
    router.push(`/new-calendar?edit=${encodeEventToNaddr(calendar)}`);
  }

  async function remove() {
    setOpen(false);
    if (!window.confirm("Delete this calendar? This can’t be undone.")) return;
    try {
      await deleteCalendar(calendar);
      router.push("/calendars");
    } catch (e) {
      console.error("Failed to delete calendar", e);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label="Calendar actions"
        onClick={() => setOpen((v) => !v)}
        disabled={publishing}
        className="flex items-center justify-center w-9 h-9 rounded-full text-on-surface-variant hover:bg-surface-high transition-colors disabled:opacity-50"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-20 top-full right-0 mt-1.5 py-1.5 w-44",
            "bg-surface rounded-[var(--radius-md)] shadow-[var(--shadow-overlay)] border border-outline-variant/30"
          )}
        >
          <button
            type="button"
            onClick={edit}
            className="w-full text-left px-3 py-2 hover:bg-surface-base transition-colors flex items-center gap-2.5 type-body-sm text-on-surface"
          >
            <Pencil size={15} className="text-primary" /> Edit calendar
          </button>
          <button
            type="button"
            onClick={remove}
            className="w-full text-left px-3 py-2 hover:bg-surface-base transition-colors flex items-center gap-2.5 type-body-sm text-error"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
