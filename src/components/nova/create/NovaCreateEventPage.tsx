"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import tzLookup from "tz-lookup";
import { CalendarPlus, Globe, Loader2, Sparkles } from "lucide-react";
import dayjs from "@/utils/formatting/dayjsConfig";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { useNovaEvent } from "@/components/nova/event/useNovaEvent";
import {
  NostrEntityPicker,
  type EntityRef,
} from "@/components/nova/calendar/NostrEntityPicker";
import { CoverImageInput } from "./CoverImageInput";
import { LocationSearchInput, type PickedLocation } from "./LocationSearchInput";
import { TagInput } from "./TagInput";
import { useCreateEvent, LoginRequiredError } from "./useCreateEvent";

function guessTimezone(): string {
  try {
    return dayjs.tz.guess();
  } catch {
    return "UTC";
  }
}

const ALL_TIMEZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [guessTimezone()];
  }
})();

export function NovaCreateEventPage() {
  const router = useRouter();
  const { publish, publishing, isLoggedIn } = useCreateEvent();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [timezone, setTimezone] = useState(guessTimezone);
  const [tzAuto, setTzAuto] = useState(false);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Optional `?calendar=<naddr>` pre-seeds the calendar this event is added to.
  const [calendarParam, setCalendarParam] = useState<string | undefined>();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("calendar");
    if (p) setCalendarParam(p);
  }, []);
  const { event: calendarEvent } = useNovaEvent(calendarParam);
  const [calendarRefs, setCalendarRefs] = useState<EntityRef[]>([]);
  const seededCalendar = useRef(false);
  useEffect(() => {
    if (!calendarEvent || seededCalendar.current) return;
    const d = calendarEvent.tags.find((t) => t[0] === "d")?.[1];
    if (!d) return;
    seededCalendar.current = true;
    setCalendarRefs([
      {
        aTag: `31924:${calendarEvent.pubkey}:${d}`,
        naddr: calendarParam ?? "",
        title: getEventMetadata(calendarEvent).title || "Calendar",
      },
    ]);
  }, [calendarEvent, calendarParam]);

  function handleLocationChange(next: PickedLocation | null) {
    setLocation(next);
    // Item #2 — auto-detect the timezone from the picked coordinates.
    if (next) {
      try {
        setTimezone(tzLookup(next.lat, next.lon));
        setTzAuto(true);
      } catch {
        /* leave the current timezone untouched on lookup failure */
      }
    }
  }

  const canSubmit =
    Boolean(title.trim()) && Boolean(start) && !imageUploading && !publishing;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (end && start && end < start) {
      setError("The end time can’t be before the start time.");
      return;
    }
    try {
      const naddr = await publish({
        title,
        summary,
        description,
        start,
        end,
        timezone,
        location,
        image,
        hashtags,
        references,
        calendarRefs: calendarRefs.map((r) => r.aTag),
      });
      router.push(`/event/${naddr}`);
    } catch (err) {
      if (err instanceof LoginRequiredError) {
        setError("Log in to publish your event.");
      } else {
        console.error(err);
        setError("Something went wrong while publishing. Please try again.");
      }
    }
  }

  return (
    <div className="max-w-[720px] mx-auto px-[var(--margin-mobile)] md:px-0 py-4 md:py-8">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="type-headline-lg-mobile md:type-headline-lg text-on-surface">
          Create event
        </h1>
        <p className="type-body-sm text-on-surface-variant">
          Publish a calendar event to Nostr.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <CoverImageInput
          value={image}
          onChange={setImage}
          onUploadingChange={setImageUploading}
        />

        <Field label="Title" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bitcoin Meetup Berlin"
            className={inputClass}
            required
          />
        </Field>

        <Field label="Short summary" hint="A one-line blurb shown under the title">
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>

        <Field label="Description" hint="The full event details">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What’s happening, who should come, what to expect…"
            rows={5}
            className={cn(inputClass, "resize-y")}
          />
        </Field>

        <LocationSearchInput value={location} onChange={handleLocationChange} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Starts" required>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Ends" hint="Optional">
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label="Timezone"
          hint={
            tzAuto ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <Sparkles size={12} /> Set automatically from the location
              </span>
            ) : (
              "Used to interpret the times above"
            )
          }
        >
          <div className="flex items-center gap-2 px-3 rounded-[var(--radius-md)] bg-surface-low border border-outline-variant/40 focus-within:border-primary transition-colors">
            <Globe size={18} className="text-primary flex-shrink-0" />
            <select
              value={timezone}
              onChange={(e) => {
                setTimezone(e.target.value);
                setTzAuto(false);
              }}
              className="flex-1 bg-transparent outline-none type-body-md text-on-surface py-2.5 appearance-none"
            >
              {ALL_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-surface text-on-surface">
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TagInput
            label="Hashtags"
            values={hashtags}
            onChange={setHashtags}
            placeholder="Add a tag, press Enter"
            transform={(raw) => raw.replace(/^#/, "").toLowerCase()}
          />
          <TagInput
            label="Links"
            values={references}
            onChange={setReferences}
            placeholder="Add a URL, press Enter"
          />
        </div>

        <NostrEntityPicker
          label="Add to calendars"
          allowedKinds={[31924]}
          value={calendarRefs}
          onChange={setCalendarRefs}
          placeholder="Search calendars or paste an naddr…"
          hint="The event will reference these calendars."
        />

        {error && (
          <p className="type-body-sm text-error" role="alert">
            {error}
          </p>
        )}
        {!isLoggedIn && (
          <p className="type-body-sm text-on-surface-variant opacity-80">
            You’ll be asked to log in when you publish.
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-full",
              "bg-primary text-on-primary type-body-md font-medium shadow-[var(--shadow-card)]",
              "transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            {publishing ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Publishing…
              </>
            ) : (
              <>
                <CalendarPlus size={18} /> Publish event
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-3 rounded-full type-body-md text-on-surface-variant hover:bg-surface-high transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-[var(--radius-md)] bg-surface-low border border-outline-variant/40 outline-none type-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary transition-colors";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="type-label-sm uppercase text-on-surface-variant">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
      {children}
      {hint && (
        <span className="type-label-sm text-on-surface-variant opacity-70 normal-case">
          {hint}
        </span>
      )}
    </label>
  );
}
