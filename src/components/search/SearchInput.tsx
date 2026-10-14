// src/components/search/SearchInput.tsx

import { Search, X, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchFlags {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

interface SearchInputProps {
  query: string;
  onQueryChange: (q: string) => void;
  flags: SearchFlags;
  onFlagsChange: (f: SearchFlags) => void;
  /** Total number of results across all categories. */
  totalCount: number;
  /** 1-based position of the currently active row, or 0 when none. */
  activePosition: number;
  onNext: () => void;
  onPrev: () => void;
  /** Activate the currently selected result. Called on Enter. */
  onActivate: () => void;
  onClose: () => void;
  error: string | null;
}

function SearchInput({
  query,
  onQueryChange,
  flags,
  onFlagsChange,
  totalCount,
  activePosition,
  onNext,
  onPrev,
  onActivate,
  onClose,
  error,
}: SearchInputProps) {
  const toggle = (key: keyof SearchFlags) => {
    onFlagsChange({ ...flags, [key]: !flags[key] });
  };

  const flagClass = (active: boolean) =>
    cn(
      "flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1 text-xs tabular-nums transition-colors",
      active
        ? "bg-accent text-foreground ring-1 ring-ring"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    );

  return (
    <div className="flex items-center gap-1 border-b border-border p-2">
      <Search
        className="ml-1 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />

      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter activates the currently selected result.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onActivate();
            return;
          }
          // Shift+Enter moves to the previous match.
          if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            onPrev();
            return;
          }
          // ArrowDown/ArrowUp move the active selection through results.
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onNext();
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onPrev();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
            return;
          }
        }}
        placeholder="Search"
        className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        spellCheck={false}
        autoComplete="off"
      />

      {error && (
        <span className="shrink-0 text-xs text-destructive" title={error}>
          invalid
        </span>
      )}

      <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground">
        {totalCount === 0 ? "0/0" : `${activePosition}/${totalCount}`}
      </span>

      <button
        type="button"
        onClick={onPrev}
        disabled={totalCount === 0}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        aria-label="Previous match"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={totalCount === 0}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        aria-label="Next match"
      >
        <ArrowDown className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => toggle("caseSensitive")}
        className={flagClass(flags.caseSensitive)}
        aria-pressed={flags.caseSensitive}
        aria-label="Match case"
        title="Match case"
      >
        Aa
      </button>
      <button
        type="button"
        onClick={() => toggle("wholeWord")}
        className={flagClass(flags.wholeWord)}
        aria-pressed={flags.wholeWord}
        aria-label="Match whole word"
        title="Match whole word"
      >
        ab
      </button>
      <button
        type="button"
        onClick={() => toggle("regex")}
        className={flagClass(flags.regex)}
        aria-pressed={flags.regex}
        aria-label="Use regular expression"
        title="Use regular expression"
      >
        .*
      </button>

      <button
        type="button"
        onClick={onClose}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Close search"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default SearchInput;
