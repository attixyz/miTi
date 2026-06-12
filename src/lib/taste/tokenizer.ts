// Taste pipeline tokenizer (like-dislike.md, "Indexing new events").
//
// Pure module — no DOM, no React, no NDK — because it runs both on the main
// thread and inside the taste Web Worker. An event is treated as a *document*:
// a list of weighted elements (title, tags, main text, …). `filteredWords` is
// the shared traversal every other taste function builds on: it walks the
// enabled elements, splits them into words with Intl.Segmenter, lowercases,
// and drops junk tokens. There are NO stopword lists: idf suppresses common
// words at scoring time, language-agnostically.

/** Serialized form of a calendar event, ready for tokenization in the worker. */
export interface EventDoc {
  /** Raw event id — changes on every edit; used to detect edited events. */
  id: string;
  /** Addressable identity `kind:pubkey:d` — stable across edits. */
  coordinate: string;
  title: string;
  /** NIP-52 `t` tags. */
  tags: string[];
  /** `event.content` — the canonical full description ("main text"). */
  content: string;
  /** The `summary` tag (short description). */
  summary: string;
  location: string;
}

/** Which optional elements participate in the analysis (global, not per-event). */
export interface TasteElementSettings {
  mainText: boolean;
  summary: boolean;
  location: boolean;
}

/** Title and tags are always indexed; the optional elements start off. */
export const DEFAULT_ELEMENT_SETTINGS: TasteElementSettings = {
  mainText: false,
  summary: false,
  location: false,
};

// Title and tags carry the signal; the body is a long tail of low-weight words.
export const ELEMENT_WEIGHTS = {
  title: 5,
  tags: 5,
  summary: 2,
  location: 2,
  main_text: 1,
} as const;

export const SUMMARY_MAX_CHARS = 140;

/**
 * Compact identity of an element selection. Persisted next to the corpus so a
 * corpus built under a different selection is detected and fully reindexed.
 */
export function elementsFingerprint(settings: TasteElementSettings): string {
  return [
    "v1",
    settings.mainText ? "m" : "-",
    settings.summary ? "s" : "-",
    settings.location ? "l" : "-",
  ].join("");
}

/** Trim the summary to SUMMARY_MAX_CHARS on a word boundary, never mid-word. */
export function trimSummary(text: string): string {
  if (text.length <= SUMMARY_MAX_CHARS) return text;
  const cut = text.slice(0, SUMMARY_MAX_CHARS + 1);
  const lastSpace = cut.search(/\s\S*$/);
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, SUMMARY_MAX_CHARS)).trimEnd();
}

// URLs must be removed BEFORE segmentation: the segmenter would otherwise
// shred them into plausible-looking words ("https", "example", "com").
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
// At least one letter or digit — kills pure punctuation and emoji tokens.
const HAS_WORD_CHAR_RE = /[\p{L}\p{N}]/u;
// Standalone numbers, including separator forms like "19:00" or "12.06.2026".
const PURE_NUMBER_RE = /^\p{N}+([.,:'’]\p{N}+)*$/u;

type Segmenter = { segment(text: string): Iterable<{ segment: string; isWordLike?: boolean }> };

let segmenter: Segmenter | null | undefined;

function getSegmenter(): Segmenter | null {
  if (segmenter === undefined) {
    // Intl.Segmenter is on all modern browsers (Firefox since 125); the regex
    // fallback below keeps indexing alive on older ones, minus CJK accuracy.
    segmenter =
      typeof Intl !== "undefined" && "Segmenter" in Intl
        ? new Intl.Segmenter(undefined, { granularity: "word" })
        : null;
  }
  return segmenter;
}

function* rawTokens(text: string): Generator<string> {
  const seg = getSegmenter();
  if (seg) {
    for (const part of seg.segment(text)) {
      if (part.isWordLike) yield part.segment;
    }
    return;
  }
  for (const token of text.split(/[^\p{L}\p{N}'’-]+/u)) {
    if (token) yield token;
  }
}

/**
 * Tokenize one element's text: strip URLs, segment into words
 * (Intl.Segmenter, granularity "word"), normalize, and drop junk —
 * punctuation, standalone numbers, single characters, emoji.
 */
export function* tokenize(text: string): Generator<string> {
  if (!text) return;
  for (const raw of rawTokens(text.replace(URL_RE, " "))) {
    const word = raw.normalize("NFKC").toLowerCase();
    if (!HAS_WORD_CHAR_RE.test(word)) continue;
    if (PURE_NUMBER_RE.test(word)) continue;
    if ([...word].length <= 1) continue; // single code point (also surrogate-paired emoji)
    yield word;
  }
}

function* enabledElements(
  doc: EventDoc,
  settings: TasteElementSettings
): Generator<{ text: string; weight: number }> {
  yield { text: doc.title, weight: ELEMENT_WEIGHTS.title };
  for (const tag of doc.tags) yield { text: tag, weight: ELEMENT_WEIGHTS.tags };
  if (settings.mainText) yield { text: doc.content, weight: ELEMENT_WEIGHTS.main_text };
  if (settings.summary) yield { text: trimSummary(doc.summary), weight: ELEMENT_WEIGHTS.summary };
  if (settings.location) yield { text: doc.location, weight: ELEMENT_WEIGHTS.location };
}

/**
 * Shared traversal of the taste pipeline: yields each of an event's words that
 * survives the junk filter, paired with the weight of the element it came
 * from. Only the globally enabled elements are walked.
 */
export function* filteredWords(
  doc: EventDoc,
  settings: TasteElementSettings
): Generator<[word: string, weight: number]> {
  for (const element of enabledElements(doc, settings)) {
    for (const word of tokenize(element.text)) {
      yield [word, element.weight];
    }
  }
}

/**
 * Σ weight per distinct word of one event — the per-occurrence stream of
 * `filteredWords` collapsed to a map. Both the feedback point split and the
 * replay distribute over this.
 */
export function docWordWeights(
  doc: EventDoc,
  settings: TasteElementSettings
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [word, weight] of filteredWords(doc, settings)) {
    weights.set(word, (weights.get(word) ?? 0) + weight);
  }
  return weights;
}
