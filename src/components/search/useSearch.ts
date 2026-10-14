// src/components/search/useSearch.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getContacts,
  getConversations,
  getMessages,
} from "@/cache/chatRepository";
import { useChatStore } from "@/store/chatStore";
import { compileSearchMatcher, type SearchMatcher } from "@/lib/searchMatcher";
import type { SearchRow } from "./SearchResultGroup";

/** Rows loaded per "load more" / "load earlier" click. */
const PAGE_SIZE = 40;

export interface SearchFlags {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface SearchCategoryFlags {
  contacts: boolean;
  conversations: boolean;
  messages: boolean;
  serves: boolean;
}

export interface UseSearchArgs {
  query: string;
  flags: SearchFlags;
  categories: SearchCategoryFlags;
  serveIds: ReadonlySet<number>;
  start: number | null;
  end: number | null;
  onOpenConversation: (
    serveId: number,
    number: string,
    timestamp?: number,
  ) => void;
  onSelectServe: (serveId: number) => void;
}

export interface CategoryResults {
  /** Full list of matches for the category. */
  rows: SearchRow[];
  /** Index of the first row currently rendered (inclusive). */
  start: number;
  /** Index past the last row currently rendered (exclusive). */
  end: number;
  /** Total number of matches. */
  total: number;
}

export interface UseSearchResult {
  matcher: SearchMatcher;
  /** Flat list of currently visible rows, in render order. */
  rows: SearchRow[];
  /** Keys of visible rows, in render order. */
  matchOrder: string[];
  /** Sum of the four category totals. */
  totalCount: number;
  contacts: CategoryResults;
  conversations: CategoryResults;
  messages: CategoryResults;
  serves: CategoryResults;
  loadMoreContacts: () => void;
  loadMoreConversations: () => void;
  loadMoreMessages: () => void;
  loadMoreServes: () => void;
  loadEarlierContacts: () => void;
  loadEarlierConversations: () => void;
  loadEarlierMessages: () => void;
  loadEarlierServes: () => void;
  resetWindows: () => void;
  isRunning: boolean;
}

function shortPreview(text: string, matcher: SearchMatcher): string {
  const ranges = matcher.match(text);
  if (ranges.length === 0) return text.slice(0, 120);
  const first = ranges[0];
  const start = Math.max(0, first.start - 40);
  const end = Math.min(text.length, first.end + 40);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

interface Window {
  start: number;
  end: number;
}

const INITIAL_WINDOW: Window = { start: 0, end: PAGE_SIZE };

export function useSearch(args: UseSearchArgs): UseSearchResult {
  const {
    query,
    flags,
    categories,
    serveIds,
    start,
    end,
    onOpenConversation,
    onSelectServe,
  } = args;

  const serves = useChatStore((s) => s.serves);

  const matcher = useMemo(
    () =>
      compileSearchMatcher({
        query,
        regex: flags.regex,
        caseSensitive: flags.caseSensitive,
        wholeWord: flags.wholeWord,
      }),
    [query, flags.regex, flags.caseSensitive, flags.wholeWord],
  );

  const [contactRows, setContactRows] = useState<SearchRow[]>([]);
  const [conversationRows, setConversationRows] = useState<SearchRow[]>([]);
  const [messageRows, setMessageRows] = useState<SearchRow[]>([]);
  const [serveRows, setServeRows] = useState<SearchRow[]>([]);

  const [contactWindow, setContactWindow] = useState<Window>(INITIAL_WINDOW);
  const [conversationWindow, setConversationWindow] =
    useState<Window>(INITIAL_WINDOW);
  const [messageWindow, setMessageWindow] = useState<Window>(INITIAL_WINDOW);
  const [serveWindow, setServeWindow] = useState<Window>(INITIAL_WINDOW);

  const [isRunning, setIsRunning] = useState(false);

  // Reset windows whenever the query or scope changes.
  useEffect(() => {
    setContactWindow(INITIAL_WINDOW);
    setConversationWindow(INITIAL_WINDOW);
    setMessageWindow(INITIAL_WINDOW);
    setServeWindow(INITIAL_WINDOW);
  }, [
    query,
    flags.regex,
    flags.caseSensitive,
    flags.wholeWord,
    serveIds,
    start,
    end,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (matcher.isEmpty || !matcher.isValid) {
      setContactRows([]);
      setConversationRows([]);
      setMessageRows([]);
      setServeRows([]);
      setIsRunning(false);
      return;
    }

    const selectedServeIds = [...serveIds].filter((id) =>
      serves.some((s) => s.id === id),
    );
    if (selectedServeIds.length === 0) {
      setContactRows([]);
      setConversationRows([]);
      setMessageRows([]);
      setServeRows([]);
      setIsRunning(false);
      return;
    }

    setIsRunning(true);

    void (async () => {
      const nextServeRows: SearchRow[] = [];
      if (categories.serves) {
        for (const s of serves) {
          if (typeof s.id !== "number") continue;
          if (!serveIds.has(s.id)) continue;
          const nameMatch = matcher.match(s.device_name).length > 0;
          const keyMatch = matcher.match(s.public_key).length > 0;
          if (!nameMatch && !keyMatch) continue;
          const id = s.id;
          nextServeRows.push({
            key: `serve:${id}`,
            title: s.device_name,
            subtitle:
              s.public_key.length > 44
                ? `${s.public_key.slice(0, 44)}…`
                : s.public_key,
            onClick: () => onSelectServe(id),
          });
        }
      }
      if (cancelled) return;
      setServeRows(nextServeRows);

      const nextContactRows: SearchRow[] = [];
      const nextConversationRows: SearchRow[] = [];

      for (const serveId of selectedServeIds) {
        if (cancelled) return;
        const serve = serves.find((s) => s.id === serveId);

        if (categories.contacts) {
          try {
            const contacts = await getContacts(serveId);
            for (const c of contacts) {
              const nameMatch = matcher.match(c.displayName).length > 0;
              const numberMatch = matcher.match(c.number).length > 0;
              if (!nameMatch && !numberMatch) continue;
              nextContactRows.push({
                key: `contact:${serveId}:${c.id}`,
                title: c.displayName || c.number,
                subtitle: c.number,
                meta: serve?.device_name,
                onClick: () => onOpenConversation(serveId, c.number),
              });
            }
          } catch (error) {
            console.warn("search: contacts read failed:", error);
          }
        }

        if (categories.conversations) {
          try {
            const convs = await getConversations(serveId);
            for (const c of convs) {
              if (start !== null && c.timestamp < start) continue;
              if (end !== null && c.timestamp > end) continue;
              const nameMatch = matcher.match(c.contactName).length > 0;
              const numberMatch = matcher.match(c.number).length > 0;
              const previewMatch = matcher.match(c.preview).length > 0;
              if (!nameMatch && !numberMatch && !previewMatch) continue;
              nextConversationRows.push({
                key: `conv:${serveId}:${c.number}`,
                title: c.contactName || c.number,
                subtitle: c.number,
                snippet: c.preview,
                meta: serve?.device_name,
                onClick: () => onOpenConversation(serveId, c.number),
              });
            }
          } catch (error) {
            console.warn("search: conversations read failed:", error);
          }
        }
      }

      if (cancelled) return;
      setContactRows(nextContactRows);
      setConversationRows(nextConversationRows);

      const nextMessageRows: SearchRow[] = [];
      if (categories.messages) {
        for (const serveId of selectedServeIds) {
          if (cancelled) return;
          const serve = serves.find((s) => s.id === serveId);

          let convs;
          try {
            convs = await getConversations(serveId);
          } catch (error) {
            console.warn("search: messages conversation read failed:", error);
            continue;
          }

          for (const c of convs) {
            if (cancelled) return;
            let msgs;
            try {
              msgs = await getMessages(serveId, c.number);
            } catch (error) {
              console.warn("search: messages read failed:", error);
              continue;
            }
            for (const m of msgs) {
              if (start !== null && m.timestamp < start) continue;
              if (end !== null && m.timestamp > end) continue;
              if (matcher.match(m.body).length === 0) continue;
              const timestamp = m.timestamp;
              nextMessageRows.push({
                key: `msg:${serveId}:${c.number}:${timestamp}`,
                title: c.contactName || c.number,
                subtitle: c.number,
                snippet: shortPreview(m.body, matcher),
                meta: serve?.device_name,
                onClick: () => onOpenConversation(serveId, c.number, timestamp),
              });
            }
          }
        }
      }

      if (cancelled) return;
      setMessageRows(nextMessageRows);
      setIsRunning(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    matcher,
    categories.contacts,
    categories.conversations,
    categories.messages,
    categories.serves,
    serveIds,
    serves,
    start,
    end,
    onOpenConversation,
    onSelectServe,
  ]);

  const contactSlice = useMemo(
    () => contactRows.slice(contactWindow.start, contactWindow.end),
    [contactRows, contactWindow],
  );
  const conversationSlice = useMemo(
    () =>
      conversationRows.slice(conversationWindow.start, conversationWindow.end),
    [conversationRows, conversationWindow],
  );
  const messageSlice = useMemo(
    () => messageRows.slice(messageWindow.start, messageWindow.end),
    [messageRows, messageWindow],
  );
  const serveSlice = useMemo(
    () => serveRows.slice(serveWindow.start, serveWindow.end),
    [serveRows, serveWindow],
  );

  const rows = useMemo(
    () => [
      ...contactSlice,
      ...conversationSlice,
      ...messageSlice,
      ...serveSlice,
    ],
    [contactSlice, conversationSlice, messageSlice, serveSlice],
  );

  const matchOrder = useMemo(() => rows.map((r) => r.key), [rows]);

  const totalCount =
    contactRows.length +
    conversationRows.length +
    messageRows.length +
    serveRows.length;

  const expandWindow = useCallback((w: Window, total: number): Window => {
    const grown = Math.min(w.end + PAGE_SIZE, total);
    if (grown === w.end) return w;
    return { start: w.start, end: grown };
  }, []);

  const shrinkWindowFromTop = useCallback((w: Window): Window => {
    const shrunk = Math.max(w.start - PAGE_SIZE, 0);
    if (shrunk === w.start) return w;
    return { start: shrunk, end: w.end };
  }, []);

  const contacts: CategoryResults = useMemo(
    () => ({
      rows: contactRows,
      start: contactWindow.start,
      end: contactWindow.end,
      total: contactRows.length,
    }),
    [contactRows, contactWindow],
  );

  const conversations: CategoryResults = useMemo(
    () => ({
      rows: conversationRows,
      start: conversationWindow.start,
      end: conversationWindow.end,
      total: conversationRows.length,
    }),
    [conversationRows, conversationWindow],
  );

  const messages: CategoryResults = useMemo(
    () => ({
      rows: messageRows,
      start: messageWindow.start,
      end: messageWindow.end,
      total: messageRows.length,
    }),
    [messageRows, messageWindow],
  );

  const servesCategory: CategoryResults = useMemo(
    () => ({
      rows: serveRows,
      start: serveWindow.start,
      end: serveWindow.end,
      total: serveRows.length,
    }),
    [serveRows, serveWindow],
  );

  return {
    matcher,
    rows,
    matchOrder,
    totalCount,
    contacts,
    conversations,
    messages,
    serves: servesCategory,
    loadMoreContacts: () =>
      setContactWindow((w) => expandWindow(w, contactRows.length)),
    loadMoreConversations: () =>
      setConversationWindow((w) => expandWindow(w, conversationRows.length)),
    loadMoreMessages: () =>
      setMessageWindow((w) => expandWindow(w, messageRows.length)),
    loadMoreServes: () =>
      setServeWindow((w) => expandWindow(w, serveRows.length)),
    loadEarlierContacts: () => setContactWindow((w) => shrinkWindowFromTop(w)),
    loadEarlierConversations: () =>
      setConversationWindow((w) => shrinkWindowFromTop(w)),
    loadEarlierMessages: () => setMessageWindow((w) => shrinkWindowFromTop(w)),
    loadEarlierServes: () => setServeWindow((w) => shrinkWindowFromTop(w)),
    resetWindows: () => {
      setContactWindow(INITIAL_WINDOW);
      setConversationWindow(INITIAL_WINDOW);
      setMessageWindow(INITIAL_WINDOW);
      setServeWindow(INITIAL_WINDOW);
    },
    isRunning,
  };
}
