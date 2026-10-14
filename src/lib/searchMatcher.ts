// src/lib/searchMatcher.ts

/**
 * Compiles a search query into a matcher used by all search categories.
 *
 * Flags mirror VS Code's three toggles:
 *   - caseSensitive  ("Aa")
 *   - wholeWord      ("ab")
 *   - regex          (".*")
 *
 * When `regex` is false, the query is treated as a literal string.
 * When `wholeWord` is true, the query is wrapped with word-boundary
 * assertions (\b...\b), which are only meaningful for word characters.
 *
 * `match(text)` returns every non-overlapping match range, or an empty
 * array if there are none. A disabled or invalid matcher always returns
 * an empty array and reports the reason via `error`.
 */
export interface MatchRange {
  start: number;
  end: number;
}

export interface SearchMatcher {
  readonly isEmpty: boolean;
  readonly isValid: boolean;
  readonly error: string | null;
  match(text: string): MatchRange[];
}

const EMPTY: SearchMatcher = {
  isEmpty: true,
  isValid: true,
  error: null,
  match: () => [],
};

export interface SearchMatcherOptions {
  query: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileSearchMatcher(
  opts: SearchMatcherOptions,
): SearchMatcher {
  const raw = opts.query;
  if (raw.length === 0) return EMPTY;

  let pattern = opts.regex ? raw : escapeRegex(raw);
  if (opts.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const flags = opts.caseSensitive ? "g" : "gi";

  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (err) {
    return {
      isEmpty: false,
      isValid: false,
      error: err instanceof Error ? err.message : "invalid pattern",
      match: () => [],
    };
  }

  // Guard against zero-length matches (e.g. regex like `.*` or `\b` alone).
  // An empty match would produce an infinite loop on a global regex.
  const safeRe = re.source === "" || pattern === "" ? null : re;
  if (safeRe === null) {
    return {
      isEmpty: false,
      isValid: false,
      error: "pattern must match at least one character",
      match: () => [],
    };
  }

  return {
    isEmpty: false,
    isValid: true,
    error: null,
    match(text: string): MatchRange[] {
      // Recompile per call because `g` regexes are stateful; a shared
      // `lastIndex` across matches would skip ranges.
      const local = new RegExp(safeRe.source, safeRe.flags);
      const out: MatchRange[] = [];
      let m: RegExpExecArray | null;
      while ((m = local.exec(text)) !== null) {
        if (m[0].length === 0) {
          local.lastIndex += 1;
          continue;
        }
        out.push({ start: m.index, end: m.index + m[0].length });
        if (out.length >= 32) break; // cap per string
      }
      return out;
    },
  };
}
