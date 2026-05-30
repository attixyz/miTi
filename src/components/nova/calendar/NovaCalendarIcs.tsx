"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Download, Link2, Rss } from "lucide-react";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { encodeEventToNaddr } from "@/utils/nostr/nostrUtils";

/** Subscribe / download / copy a calendar as an .ics feed (server route). */
export function NovaCalendarIcs({ calendar }: { calendar: NDKEvent }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  function webcalUrl() {
    const host = window.location.origin.replace(/^https?:\/\//, "");
    return `webcal://${host}/api/calendar/${encodeEventToNaddr(calendar)}/ics`;
  }

  function subscribe() {
    window.open(webcalUrl(), "_blank");
    setOpen(false);
  }

  function download() {
    const link = document.createElement("a");
    link.href = `${window.location.origin}/api/calendar/${calendar.id}/ics`;
    link.download = `${getEventMetadata(calendar).title || "calendar"}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setOpen(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(webcalUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-high text-on-surface type-body-sm font-medium hover:bg-surface-base transition-colors"
      >
        <CalendarPlus size={16} className="text-primary" />
        Subscribe
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-20 top-full right-0 mt-1.5 py-1.5 w-60",
            "bg-surface rounded-[var(--radius-md)] shadow-[var(--shadow-overlay)] border border-outline-variant/30"
          )}
        >
          <MenuItem icon={<Rss size={15} />} title="Subscribe" desc="Auto-updates in your calendar app" onClick={subscribe} />
          <MenuItem icon={<Download size={15} />} title="Download .ics" desc="One-time export" onClick={download} />
          <MenuItem
            icon={<Link2 size={15} />}
            title={copied ? "Copied!" : "Copy webcal link"}
            desc="Share the subscription URL"
            onClick={copyLink}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-surface-base transition-colors flex items-start gap-2.5"
    >
      <span className="text-primary mt-0.5 flex-shrink-0">{icon}</span>
      <span className="flex flex-col">
        <span className="type-body-sm font-medium text-on-surface">{title}</span>
        <span className="type-label-sm text-on-surface-variant opacity-70">{desc}</span>
      </span>
    </button>
  );
}
