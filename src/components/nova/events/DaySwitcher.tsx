"use client";

import { useRef, useEffect } from "react";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";

interface DaySwitcherProps {
  selectedDay: string;
  onSelect: (day: string) => void;
  windowDays?: number;
}

export function DaySwitcher({
  selectedDay,
  onSelect,
  windowDays = 30,
}: DaySwitcherProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const days = Array.from({ length: windowDays }, (_, i) =>
    dayjs().add(i, "day")
  );

  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedDay]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-2 pr-[var(--margin-mobile)] md:pr-[var(--margin-desktop)]"
    >
      {days.map((day) => {
        const key = day.format("YYYY-MM-DD");
        const isSelected = key === selectedDay;
        const isToday = day.isSame(dayjs(), "day");

        const pill = (
          <button
            key={key}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => onSelect(key)}
            className={cn(
              "flex-shrink-0 flex flex-col items-center justify-center",
              "w-14 h-14 rounded-[var(--radius-md)] transition-all duration-200",
              "text-sm font-medium",
              isSelected
                ? "bg-primary text-on-primary shadow-[var(--shadow-card)]"
                : "bg-surface-low text-on-surface-variant hover:bg-surface-base"
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                isSelected ? "opacity-80" : "opacity-60"
              )}
            >
              {isToday ? "Today" : day.format("ddd")}
            </span>
            <span className="text-lg font-bold leading-tight">
              {day.format("D")}
            </span>
          </button>
        );

        // Pin "Today" to the left edge: it stays put while the remaining days
        // scroll horizontally behind it. The wrapper carries the left gutter
        // (pl) — the scroller itself has none — so the pill lines up with the
        // event-card column, and its opaque backing spans the whole gutter so
        // scrolling pills are fully hidden behind it rather than peeking out.
        if (isToday) {
          return (
            <div
              key={key}
              className="sticky left-0 z-10 flex-shrink-0 bg-surface pr-2 pl-[var(--margin-mobile)] md:pl-[var(--margin-desktop)]"
            >
              {pill}
            </div>
          );
        }

        return pill;
      })}
    </div>
  );
}
