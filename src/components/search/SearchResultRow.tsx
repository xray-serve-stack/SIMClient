// src/components/search/SearchResultRow.tsx

import HighlightedText from "./HighlightedText";
import type { SearchMatcher } from "@/lib/searchMatcher";
import { cn } from "@/lib/utils";

interface SearchResultRowProps {
  /** Stable id for this row, used for scroll-into-view. */
  id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  meta?: string;
  matcher: SearchMatcher;
  /** Whether this row corresponds to the currently active match index. */
  active?: boolean;
  onClick: () => void;
}

function SearchResultRow({
  id,
  title,
  subtitle,
  snippet,
  meta,
  matcher,
  active,
  onClick,
}: SearchResultRowProps) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-colors",
        "hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring",
        active && "bg-accent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm">
          <HighlightedText text={title} matcher={matcher} />
        </span>
        {meta && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {meta}
          </span>
        )}
      </div>
      {subtitle && (
        <span className="truncate text-xs text-muted-foreground">
          <HighlightedText text={subtitle} matcher={matcher} />
        </span>
      )}
      {snippet && (
        <span className="truncate text-xs text-muted-foreground">
          <HighlightedText text={snippet} matcher={matcher} />
        </span>
      )}
    </button>
  );
}

export default SearchResultRow;
