// src/components/search/HighlightedText.tsx

import { useMemo } from "react";
import type { SearchMatcher } from "@/lib/searchMatcher";

interface HighlightedTextProps {
  text: string;
  matcher: SearchMatcher;
  /** Optional secondary colour class for the <mark>. Defaults to yellow. */
  className?: string;
}

/**
 * Renders `text` with every match from `matcher` wrapped in a <mark>.
 * Non-matching segments are emitted unchanged.
 */
function HighlightedText({ text, matcher, className }: HighlightedTextProps) {
  const ranges = useMemo(() => matcher.match(text), [matcher, text]);

  if (ranges.length === 0) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.start > cursor) {
      nodes.push(text.slice(cursor, r.start));
    }
    nodes.push(
      <mark
        key={`${r.start}-${r.end}-${i}`}
        className={
          className ??
          "rounded-sm bg-yellow-400/40 px-0.5 text-foreground dark:bg-yellow-500/30"
        }
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}

export default HighlightedText;
