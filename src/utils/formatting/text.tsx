// src/utils/formatting/text.tsx

/**
 * Trim `text` to at most `max` characters on a word boundary, appending an
 * ellipsis when anything was dropped. If the limit lands inside a word, it backs
 * up to the last whitespace so a word is never cut in half; the only exception
 * is a first "word" longer than `max`, where a hard cut is unavoidable.
 */
export function truncateAtWord(text: string, max = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;

  const slice = trimmed.slice(0, max);
  const lastSpace = slice.search(/\s\S*$/); // index of the last whitespace run
  const head = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${head.trimEnd()}…`;
}

const formatTextWithLineBreaks = (text?: string) => {
  if (!text) return null;
  return text.split("\n").map((line, index, arr) => (
    <span key={index}>
      {line}
      {index !== arr.length - 1 && <br />}
    </span>
  ));
};

export { formatTextWithLineBreaks };
