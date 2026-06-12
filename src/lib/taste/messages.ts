// Message protocol between the main-thread indexer and the taste Web Worker.

import type { EventDoc, TasteElementSettings } from "./tokenizer";

export type TasteWorkerRequest =
  | {
      /** Incremental: add never-seen events to the corpus; skip known ones. */
      type: "index";
      docs: EventDoc[];
      settings: TasteElementSettings;
    }
  | {
      /** Full rebuild of the corpus from the complete set of known events. */
      type: "reindex";
      docs: EventDoc[];
      settings: TasteElementSettings;
    };

export type TasteWorkerResponse =
  | {
      type: "done";
      mode: "index" | "reindex";
      /** Events whose words were (re)counted in this run. */
      indexed: number;
      /**
       * True when the incremental path hit something it cannot fix in place —
       * an edited event (old words can't be subtracted) or a corpus built
       * under a different element selection. Caller must send a "reindex".
       */
      needsReindex: boolean;
    }
  | { type: "error"; message: string };
