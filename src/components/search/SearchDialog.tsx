// src/components/search/SearchDialog.tsx

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import SearchInput, { type SearchFlags } from "./SearchInput";
import ServeChips from "./ServeChips";
import SearchResultGroup from "./SearchResultGroup";
import { useSearch, type SearchCategoryFlags } from "./useSearch";
import { cn } from "@/lib/utils";

const START_DEFAULT = "1960-12-28 23:59:59";
const END_DEFAULT = "2050-12-28 23:59:59";
const DIGIT_SLOTS = 14;

interface SearchDialogProps {
  onClose: () => void;
}

function defaultServeIds(
  serves: { id?: number }[],
  activeServeId: number | null,
): Set<number> {
  if (activeServeId !== null) return new Set([activeServeId]);
  const first = serves.find((s) => typeof s.id === "number")?.id;
  return first !== undefined ? new Set([first]) : new Set();
}

function templateToDigits(template: string): string[] {
  const digits = template.replace(/\D/g, "").split("");
  if (digits.length !== DIGIT_SLOTS) {
    throw new Error(
      `templateToDigits: expected ${DIGIT_SLOTS} digits, got ${digits.length}`,
    );
  }
  return digits;
}

function digitsToDateTime(
  digits: string[],
  defaultTemplate: string,
): number | null {
  const defaults = templateToDigits(defaultTemplate);
  const filled = digits.map((d, i) =>
    d >= "0" && d <= "9" ? d : (defaults[i] ?? "0"),
  );
  const s =
    `${filled.slice(0, 4).join("")}-` +
    `${filled.slice(4, 6).join("")}-` +
    `${filled.slice(6, 8).join("")} ` +
    `${filled.slice(8, 10).join("")}:` +
    `${filled.slice(10, 12).join("")}:` +
    `${filled.slice(12, 14).join("")}`;
  return parseFullDateTime(s);
}

function parseFullDateTime(s: string): number | null {
  if (s.length !== 19) return null;

  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  const hour = Number(s.slice(11, 13));
  const minute = Number(s.slice(14, 16));
  const second = Number(s.slice(17, 19));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  const dt = new Date(year, month - 1, day, hour, minute, second, 0);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day ||
    dt.getHours() !== hour ||
    dt.getMinutes() !== minute ||
    dt.getSeconds() !== second
  ) {
    return null;
  }

  return dt.getTime();
}

// ---------------------------------------------------------------------------
// Digit cell
// ---------------------------------------------------------------------------

interface DigitCellProps {
  value: string;
  defaultDigit: string;
  disabled: boolean;
  onChange: (next: string) => void;
  onFocusPrev: () => void;
  onFocusNext: () => void;
  onPaste: (text: string) => void;
  refCallback: (el: HTMLInputElement | null) => void;
}

function DigitCell({
  value,
  defaultDigit,
  disabled,
  onChange,
  onFocusPrev,
  onFocusNext,
  onPaste,
  refCallback,
}: DigitCellProps) {
  const isDigit = (ch: string) => ch >= "0" && ch <= "9";

  return (
    <input
      ref={refCallback}
      type="text"
      inputMode="numeric"
      maxLength={1}
      value={value}
      disabled={disabled}
      onFocus={(e) => {
        e.currentTarget.select();
      }}
      onKeyDown={(e) => {
        if (e.key.length === 1 && isDigit(e.key)) {
          e.preventDefault();
          onChange(e.key);
          onFocusNext();
          return;
        }

        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          onChange(defaultDigit);
          const el = e.currentTarget;
          el.value = defaultDigit;
          el.select();
          return;
        }

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onFocusPrev();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onFocusNext();
          return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
        }
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw.length === 0) {
          onChange(defaultDigit);
          return;
        }
        const ch = raw.slice(-1);
        if (isDigit(ch)) {
          onChange(ch);
          onFocusNext();
        } else {
          e.target.value = value;
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        onPaste(text);
      }}
      className={cn(
        "h-7 w-4 rounded-sm border border-border bg-background text-center",
        "font-mono text-xs tabular-nums outline-none",
        "focus:border-ring focus:ring-1 focus:ring-ring",
        "disabled:opacity-50",
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// DateField
// ---------------------------------------------------------------------------

interface DateFieldProps {
  label: string;
  defaultTemplate: string;
  digits: string[];
  setDigits: (next: string[]) => void;
  disabled: boolean;
}

function DateField({
  label,
  defaultTemplate,
  digits,
  setDigits,
  disabled,
}: DateFieldProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const defaults = useMemo(
    () => templateToDigits(defaultTemplate),
    [defaultTemplate],
  );

  const focusIndex = (i: number) => {
    const idx = Math.max(0, Math.min(i, DIGIT_SLOTS - 1));
    const el = refs.current[idx];
    el?.focus();
    el?.select();
  };

  const setCell = (i: number, v: string) => {
    const next = digits.slice();
    next[i] = v;
    setDigits(next);
  };

  const reset = () => {
    setDigits(templateToDigits(defaultTemplate));
    focusIndex(0);
  };

  const distributePaste = (text: string) => {
    const pastedDigits = text.replace(/\D/g, "");
    if (pastedDigits.length === 0) return;

    const next = digits.slice();
    let written = 0;
    for (let i = 0; i < DIGIT_SLOTS && written < pastedDigits.length; i++) {
      next[i] = pastedDigits[written];
      written++;
    }
    setDigits(next);

    const nextFocusIndex = Math.min(written, DIGIT_SLOTS - 1);
    focusIndex(nextFocusIndex);
  };

  const cell = (i: number) => (
    <DigitCell
      key={i}
      value={digits[i] ?? ""}
      defaultDigit={defaults[i] ?? "0"}
      disabled={disabled}
      onChange={(v) => setCell(i, v)}
      onFocusPrev={() => focusIndex(i - 1)}
      onFocusNext={() => focusIndex(i + 1)}
      onPaste={(text) => distributePaste(text)}
      refCallback={(el) => {
        refs.current[i] = el;
      }}
    />
  );

  const sep = (ch: string, key: string) => (
    <span
      key={key}
      className="select-none px-0.5 font-mono text-xs text-muted-foreground"
      aria-hidden
    >
      {ch}
    </span>
  );

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <div
        className="flex items-center gap-0.5"
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text");
          distributePaste(text);
        }}
      >
        {[0, 1, 2, 3].map(cell)}
        {sep("-", "sep-year")}
        {[4, 5].map(cell)}
        {sep("-", "sep-month")}
        {[6, 7].map(cell)}
        {sep(" ", "sep-day")}
        {[8, 9].map(cell)}
        {sep(":", "sep-hour")}
        {[10, 11].map(cell)}
        {sep(":", "sep-minute")}
        {[12, 13].map(cell)}
      </div>
      <button
        type="button"
        onClick={reset}
        disabled={disabled}
        aria-label={`Reset ${label} to default`}
        title={`Reset to ${defaultTemplate}`}
        className={cn(
          "ml-1 flex h-6 w-6 items-center justify-center rounded",
          "text-muted-foreground hover:bg-accent hover:text-foreground",
          "disabled:opacity-40",
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchDialog
// ---------------------------------------------------------------------------

function SearchDialog({ onClose }: SearchDialogProps) {
  const navigate = useNavigate();
  const serves = useChatStore((s) => s.serves);
  const servePresence = useChatStore((s) => s.servePresence);
  const activeServeId = useChatStore((s) => s.activeServeId);
  const setActiveServe = useChatStore((s) => s.setActiveServe);
  const setActiveServeAndWait = useChatStore((s) => s.setActiveServeAndWait);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const setScrollToMessage = useChatStore((s) => s.setScrollToMessage);

  const [query, setQuery] = useState("");
  const [flags, setFlags] = useState<SearchFlags>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });
  const [categories, setCategories] = useState<SearchCategoryFlags>({
    contacts: true,
    conversations: true,
    messages: true,
    serves: true,
  });
  const [serveIds, setServeIds] = useState<Set<number>>(() =>
    defaultServeIds(serves, activeServeId),
  );

  const [startDigits, setStartDigits] = useState<string[]>(() =>
    templateToDigits(START_DEFAULT),
  );
  const [endDigits, setEndDigits] = useState<string[]>(() =>
    templateToDigits(END_DEFAULT),
  );

  const [activeIndex, setActiveIndex] = useState(0);

  const resultsRef = useRef<HTMLDivElement | null>(null);

  const start = useMemo(
    () => digitsToDateTime(startDigits, START_DEFAULT),
    [startDigits],
  );
  const end = useMemo(
    () => digitsToDateTime(endDigits, END_DEFAULT),
    [endDigits],
  );

  // ---- Result activation ----------------------------------------------
  const onOpenConversation = useCallback(
    async (serveId: number, number: string, timestamp?: number) => {
      navigate("/");
      await setActiveServeAndWait(serveId, number);
      setActiveChat(number);
      if (typeof timestamp === "number") {
        setScrollToMessage({ number, timestamp });
      }
      navigate(`/chat/${encodeURIComponent(number)}`);
      onClose();
    },
    [
      navigate,
      setActiveServeAndWait,
      setActiveChat,
      setScrollToMessage,
      onClose,
    ],
  );

  const onSelectServe = useCallback(
    async (serveId: number) => {
      navigate("/");
      await setActiveServe(serveId);
      onClose();
    },
    [navigate, setActiveServe, onClose],
  );

  const search = useSearch({
    query,
    flags,
    categories,
    serveIds,
    start,
    end,
    onOpenConversation,
    onSelectServe,
  });

  const activeKey =
    search.matchOrder.length === 0 ? null : search.matchOrder[activeIndex];

  const totalCount = search.totalCount;
  const activePosition =
    totalCount === 0 || activeKey === null ? 0 : activeIndex + 1;

  // ---- Activate the active row -----------------------------------------
  const activateActiveRow = useCallback(() => {
    if (activeKey === null) return;
    const row = search.rows.find((r) => r.key === activeKey);
    row?.onClick();
  }, [activeKey, search.rows]);

  // ---- Match navigation ------------------------------------------------
  //
  // Arrow Down / Arrow Up advance the selection by one row. The layout
  // effect below keeps the active row centered in the viewport, which
  // brings the "Show more" control of the current category into view
  // when the user approaches its end. The IntersectionObserver on that
  // control then requests the next page. This is the same mechanism
  // that lazy-loads when the user scrolls with the mouse, so keyboard
  // and mouse behave identically.
  const goNext = useCallback(() => {
    if (search.matchOrder.length === 0) return;
    setActiveIndex((i) => i + 1);
  }, [search.matchOrder.length]);

  const goPrev = useCallback(() => {
    if (search.matchOrder.length === 0) return;
    setActiveIndex((i) => Math.max(i - 1, 0));
  }, [search.matchOrder.length]);

  // Clamp the active index into range whenever the visible set changes.
  useEffect(() => {
    if (search.matchOrder.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((i) =>
      Math.min(Math.max(i, 0), search.matchOrder.length - 1),
    );
  }, [search.matchOrder]);

  // ---- Scroll the active row into view ---------------------------------
  //
  // block: "center" places the active row in the middle of the viewport.
  // This matches the viewport state produced by a mouse wheel: there is
  // always room below the row, the container keeps scrolling with each
  // arrow press, and the IntersectionObserver at the bottom of each
  // group fires naturally, triggering the next page load the same way
  // it does on wheel scroll.
  useLayoutEffect(() => {
    if (activeKey === null) return;
    const el = document.getElementById(`search-row-${activeKey}`);
    if (el === null) return;
    el.scrollIntoView({ block: "center", behavior: "instant" });
  }, [activeKey, search.matchOrder.length]);

  // ---- Close on Escape -------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ---- Serve selection -------------------------------------------------
  const allServeIds = useMemo(() => {
    const ids: number[] = [];
    for (const s of serves) {
      if (typeof s.id === "number") ids.push(s.id);
    }
    return ids;
  }, [serves]);

  const onlineServeIds = useMemo(
    () => allServeIds.filter((id) => servePresence[id] === "online"),
    [allServeIds, servePresence],
  );

  const offlineServeIds = useMemo(
    () => allServeIds.filter((id) => servePresence[id] !== "online"),
    [allServeIds, servePresence],
  );

  const toggleServe = (id: number) => {
    setServeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const reverseServes = () => {
    setServeIds((prev) => {
      const next = new Set<number>();
      for (const id of allServeIds) {
        if (!prev.has(id)) next.add(id);
      }
      if (next.size === 0) return prev;
      return next;
    });
  };

  const selectOnlineServes = () => {
    if (onlineServeIds.length === 0) return;
    setServeIds(new Set(onlineServeIds));
  };

  const selectOfflineServes = () => {
    if (offlineServeIds.length === 0) return;
    setServeIds(new Set(offlineServeIds));
  };

  const toggleCategory = (key: keyof SearchCategoryFlags) => {
    setCategories((c) => ({ ...c, [key]: !c[key] }));
  };

  const onScrim = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const onResultsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      goNext();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      goPrev();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      activateActiveRow();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-8"
      onMouseDown={onScrim}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SearchInput
          query={query}
          onQueryChange={(q) => {
            setQuery(q);
            setActiveIndex(0);
          }}
          flags={flags}
          onFlagsChange={setFlags}
          totalCount={totalCount}
          activePosition={activePosition}
          onNext={goNext}
          onPrev={goPrev}
          onActivate={activateActiveRow}
          onClose={onClose}
          error={search.matcher.error}
        />

        <div className="flex flex-col gap-2 border-b border-border px-2 py-2">
          <ServeChips
            selectedServeIds={serveIds}
            onToggle={toggleServe}
            onReverse={reverseServes}
            onSelectOnline={selectOnlineServes}
            onSelectOffline={selectOfflineServes}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Categories:</span>
            {(
              [
                ["contacts", "Contacts"],
                ["conversations", "Conversations"],
                ["messages", "Messages"],
                ["serves", "Serves"],
              ] as const
            ).map(([key, label]) => {
              const on = categories[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleCategory(key)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    on
                      ? "border-ring bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/50",
                  )}
                  aria-pressed={on}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <DateField
              label="start"
              defaultTemplate={START_DEFAULT}
              digits={startDigits}
              setDigits={setStartDigits}
              disabled={!categories.messages}
            />
            <DateField
              label="end"
              defaultTemplate={END_DEFAULT}
              digits={endDigits}
              setDigits={setEndDigits}
              disabled={!categories.messages}
            />
          </div>
        </div>

        <div
          ref={resultsRef}
          tabIndex={0}
          onKeyDown={onResultsKeyDown}
          className="flex-1 overflow-y-auto outline-none"
        >
          {search.isRunning && (
            <div className="p-2 text-xs text-muted-foreground">searching…</div>
          )}

          {!search.isRunning && search.matchOrder.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {search.matcher.isEmpty
                ? "Type to search."
                : search.matcher.error
                  ? "Invalid pattern."
                  : "No results."}
            </div>
          )}

          {search.matchOrder.length > 0 && (
            <div className="flex flex-col gap-2 py-2">
              <SearchResultGroup
                label="Contacts"
                rows={search.contacts.rows}
                start={search.contacts.start}
                end={search.contacts.end}
                total={search.contacts.total}
                matcher={search.matcher}
                activeKey={activeKey}
                onLoadMore={search.loadMoreContacts}
                onLoadEarlier={search.loadEarlierContacts}
              />
              <SearchResultGroup
                label="Conversations"
                rows={search.conversations.rows}
                start={search.conversations.start}
                end={search.conversations.end}
                total={search.conversations.total}
                matcher={search.matcher}
                activeKey={activeKey}
                onLoadMore={search.loadMoreConversations}
                onLoadEarlier={search.loadEarlierConversations}
              />
              <SearchResultGroup
                label="Messages"
                rows={search.messages.rows}
                start={search.messages.start}
                end={search.messages.end}
                total={search.messages.total}
                matcher={search.matcher}
                activeKey={activeKey}
                onLoadMore={search.loadMoreMessages}
                onLoadEarlier={search.loadEarlierMessages}
              />
              <SearchResultGroup
                label="Serves"
                rows={search.serves.rows}
                start={search.serves.start}
                end={search.serves.end}
                total={search.serves.total}
                matcher={search.matcher}
                activeKey={activeKey}
                onLoadMore={search.loadMoreServes}
                onLoadEarlier={search.loadEarlierServes}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchDialog;
