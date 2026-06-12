"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTasteDb, getMetaNumber, META_KEYS } from "@/lib/taste/db";
import type { WordRow } from "@/lib/taste/db";
import { DebugGate } from "./DebugGate";
import {
  requestFullReindex,
  isIndexing,
  TASTE_CORPUS_CHANGED_EVENT,
  TASTE_STATUS_EVENT,
} from "@/lib/taste/indexer";

const ROW_LIMIT = 300;

interface CorpusStats {
  totalWords: number;
  indexedEvents: number;
  T: number;
  tasteVersion: number;
}

/**
 * /debug/words — inspect the taste corpus: every word's weighted `count` and
 * accumulated `like_score` (like-dislike.md, "UI and routes"). Only rendered
 * when the debug flag is on; live-reloads whenever the worker changes the DB.
 */
export function DebugWordsPage() {
  return (
    <DebugGate what="inspect the word corpus">
      <WordsCorpus />
    </DebugGate>
  );
}

function WordsCorpus() {
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [rows, setRows] = useState<WordRow[]>([]);
  const [search, setSearch] = useState("");
  const [indexing, setIndexing] = useState(false);

  const load = useCallback(async () => {
    const db = getTasteDb();
    if (!db) return;
    const query = search.trim().toLowerCase();
    const [totalWords, indexedEvents, T, tasteVersion, words] = await Promise.all([
      db.words.count(),
      db.indexed_events.count(),
      getMetaNumber(db, META_KEYS.T),
      getMetaNumber(db, META_KEYS.tasteVersion),
      query
        ? db.words.where("word").startsWith(query).limit(ROW_LIMIT).toArray()
        : db.words.orderBy("count").reverse().limit(ROW_LIMIT).toArray(),
    ]);
    if (query) words.sort((a, b) => b.count - a.count);
    setStats({ totalWords, indexedEvents, T, tasteVersion });
    setRows(words);
  }, [search]);

  useEffect(() => {
    void load();
    setIndexing(isIndexing());
    const onCorpusChange = () => void load();
    const onStatus = (e: Event) => {
      setIndexing(Boolean((e as CustomEvent<{ indexing: boolean }>).detail?.indexing));
    };
    window.addEventListener(TASTE_CORPUS_CHANGED_EVENT, onCorpusChange);
    window.addEventListener(TASTE_STATUS_EVENT, onStatus);
    return () => {
      window.removeEventListener(TASTE_CORPUS_CHANGED_EVENT, onCorpusChange);
      window.removeEventListener(TASTE_STATUS_EVENT, onStatus);
    };
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Word corpus</h1>
        <button
          type="button"
          onClick={() => requestFullReindex()}
          disabled={indexing}
          className={cn(
            "flex items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-xs font-semibold text-on-surface",
            "transition-colors duration-200 hover:bg-surface-high",
            indexing && "cursor-default opacity-60"
          )}
        >
          <RefreshCw size={14} className={cn(indexing && "animate-spin")} />
          {indexing ? "Indexing…" : "Reindex all"}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Distinct words" value={stats?.totalWords} />
        <Stat label="Indexed events" value={stats?.indexedEvents} />
        <Stat label="T (token total)" value={stats?.T} />
        <Stat label="Taste version" value={stats?.tasteVersion} />
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter words by prefix…"
        className="mb-4 w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
      />

      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface/80">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant/70">
              <th className="px-4 py-2 font-semibold">Word</th>
              <th className="px-4 py-2 text-right font-semibold">Count</th>
              <th className="px-4 py-2 text-right font-semibold">Like score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.word} className="border-t border-outline-variant/15">
                <td className="break-all px-4 py-1.5 text-on-surface">{row.word}</td>
                <td className="px-4 py-1.5 text-right tabular-nums text-on-surface-variant">
                  {row.count}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-on-surface-variant">
                  {row.like_score.toFixed(3)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-on-surface-variant">
                  {search
                    ? "No words match."
                    : "Corpus is empty — open /list to fetch and index events."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length === ROW_LIMIT && (
        <p className="mt-2 px-1 text-xs text-on-surface-variant/70">
          Showing the top {ROW_LIMIT} words — use the filter to narrow down.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface/80 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums text-on-surface">{value ?? "—"}</div>
    </div>
  );
}
