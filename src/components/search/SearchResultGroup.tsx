// src/components/search/SearchResultGroup.tsx

import { useEffect, useRef } from "react";
import SearchResultRow from "./SearchResultRow";
import type { SearchMatcher } from "@/lib/searchMatcher";

export interface SearchRow {
  key: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  meta?: string;
  onClick: () => void;
}

interface SearchResultGroupProps {
  label: string;
  rows: SearchRow[];
  start: number;
  end: number;
  total: number;
  matcher: SearchMatcher;
  activeKey: string | null;
  onLoadMore: () => void;
  onLoadEarlier: () => void;
}

/**
 * One category section.
 *
 * Lazy loading:
 *   - Rows are sliced to [start, end).
 *   - A top "load earlier" control appears when start > 0.
 *   - A bottom "Show more" control appears when end < total.
 *   - IntersectionObservers observe both controls and call the
 *     respective callback when they enter the viewport.
 *
 * The bottom observer uses a large rootMargin so that as the user
 * scrolls or presses Down through the list, the next page loads well
 * before the control is reached. The top observer uses the same margin
 * symmetrically.
 *
 * There is no cap on the window; growth is bounded by what the user
 * actually scrolls to.
 */
function SearchResultGroup({
  label,
  rows,
  start,
  end,
  total,
  matcher,
  activeKey,
  onLoadMore,
  onLoadEarlier,
}: SearchResultGroupProps) {
  const topRef = useRef<HTMLButtonElement | null>(null);
  const bottomRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (end >= total) return;
    const el = bottomRef.current;
    if (el === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onLoadMore();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, total, onLoadMore]);

  useEffect(() => {
    if (start <= 0) return;
    const el = topRef.current;
    if (el === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onLoadEarlier();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [start, onLoadEarlier]);

  if (total === 0) return null;

  const visibleSlice = rows.slice(start, end);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-popover/95 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
        <span>{label}</span>
        <span className="tabular-nums">{total}</span>
      </div>
      <div className="flex flex-col gap-0.5 px-1">
        {start > 0 && (
          <button
            ref={topRef}
            type="button"
            onClick={onLoadEarlier}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Show earlier ({start} earlier)
          </button>
        )}
        {visibleSlice.map((r) => (
          <SearchResultRow
            key={r.key}
            id={`search-row-${r.key}`}
            title={r.title}
            subtitle={r.subtitle}
            snippet={r.snippet}
            meta={r.meta}
            matcher={matcher}
            active={activeKey === r.key}
            onClick={r.onClick}
          />
        ))}
        {end < total && (
          <button
            ref={bottomRef}
            type="button"
            onClick={onLoadMore}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Show more ({total - end} remaining)
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchResultGroup;
