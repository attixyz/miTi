"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEventMetadata } from "@/utils/nostr/eventUtils";
import { CoverImageInput } from "@/components/nova/create/CoverImageInput";
import { useNovaEvent } from "@/components/nova/event/useNovaEvent";
import { NostrEntityPicker, type EntityRef } from "./NostrEntityPicker";
import {
  useCalendarMutations,
  LoginRequiredError,
} from "./useCalendarMutations";

export function NovaCreateCalendarPage() {
  const router = useRouter();
  const { saveCalendar, publishing, isLoggedIn } = useCalendarMutations();

  // Edit mode is driven by `?edit=<naddr>` (read client-side to avoid a
  // Suspense boundary requirement on the route).
  const [editNaddr, setEditNaddr] = useState<string | undefined>();
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("edit");
    if (param) setEditNaddr(param);
  }, []);
  const { event: existing } = useNovaEvent(editNaddr);
  const isEdit = Boolean(editNaddr);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [eventRefs, setEventRefs] = useState<EntityRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prefilled = useRef(false);

  // Prefill once when editing an existing calendar.
  useEffect(() => {
    if (!existing || prefilled.current) return;
    prefilled.current = true;
    const meta = getEventMetadata(existing);
    setTitle(meta.title || "");
    setDescription(meta.summary || existing.content || "");
    setImage(meta.image || null);
    setEventRefs(
      existing.tags
        .filter((t) => t[0] === "a")
        .map((t) => ({ aTag: t[1], naddr: t[1], title: t[1] }))
    );
  }, [existing]);

  const canSubmit = Boolean(title.trim()) && !imageUploading && !publishing;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const naddr = await saveCalendar(
        {
          title,
          description,
          image,
          eventRefs: eventRefs.map((r) => r.aTag),
        },
        isEdit ? existing ?? undefined : undefined
      );
      router.push(`/calendar/${naddr}`);
    } catch (err) {
      if (err instanceof LoginRequiredError) {
        setError("Log in to publish your calendar.");
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
          {isEdit ? "Edit calendar" : "Create calendar"}
        </h1>
        <p className="type-body-sm text-on-surface-variant">
          A calendar groups related events together.
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
            placeholder="e.g. Berlin Bitcoin Meetups"
            className={inputClass}
            required
          />
        </Field>

        <Field label="Description" hint="Shown under the calendar title">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this calendar is about…"
            rows={4}
            className={cn(inputClass, "resize-y")}
          />
        </Field>

        <NostrEntityPicker
          label="Events in this calendar"
          allowedKinds={[31922, 31923]}
          value={eventRefs}
          onChange={setEventRefs}
          placeholder="Search events or paste an naddr…"
          hint="Add the events this calendar should list."
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
                <CalendarPlus size={18} /> {isEdit ? "Save changes" : "Publish calendar"}
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
