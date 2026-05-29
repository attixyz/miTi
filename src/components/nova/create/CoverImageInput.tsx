"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBlossomUpload } from "@/hooks/useBlossomUpload";

interface CoverImageInputProps {
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

export function CoverImageInput({
  value,
  onChange,
  onUploadingChange,
}: CoverImageInputProps) {
  const { uploadFile } = useBlossomUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadFile(file);
      if (!url || url === "error") {
        setError("Upload failed — are you logged in?");
      } else {
        onChange(url);
      }
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-label-sm uppercase text-on-surface-variant">
        Cover image
      </span>

      <div
        className={cn(
          "relative w-full aspect-video rounded-[var(--radius-lg)] overflow-hidden",
          "border border-dashed border-outline-variant/60 bg-surface-low",
          "transition-colors"
        )}
      >
        {value ? (
          <>
            <img src={value} alt="Cover" className="w-full h-full object-cover" />
            <button
              type="button"
              aria-label="Remove cover image"
              onClick={() => onChange(null)}
              className="absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-full bg-surface/80 backdrop-blur-md text-on-surface shadow-lg active:scale-95"
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-base transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 size={28} className="animate-spin text-primary" />
                <span className="type-body-sm">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus size={28} className="text-primary" />
                <span className="type-body-sm">Upload a cover image</span>
                <span className="type-label-sm opacity-60">
                  Stored on blossom.nostr.build
                </span>
              </>
            )}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <span className="type-body-sm text-error">{error}</span>}
    </div>
  );
}
