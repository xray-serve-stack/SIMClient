import { useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useChatStore } from "@/store/chatStore";
import { Message, MessageGroup } from "@/types";
import { formatDateHeader, isSameDay } from "@/lib/utils";
import MessageBubble from "./MessageBubble";

interface MessageListProps {
  number: string;
}

const EMPTY_MESSAGES: Message[] = [];
const PIN_THRESHOLD_PX = 32;

function MessageList({ number }: MessageListProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * True when the user is at (or within PIN_THRESHOLD_PX of) the bottom.
   * Recomputed on every scroll event. Reset to true when the conversation
   * changes; set to false when a scroll-to-message target is reached.
   */
  const pinnedToBottomRef = useRef(true);
  /**
   * Tracks the previous `number` so we can reset the pin only when the
   * conversation actually changes, not on every render.
   */
  const prevNumberRef = useRef<string | null>(null);

  const messages = useChatStore((s) => s.messages[number]) ?? EMPTY_MESSAGES;
  const scrollToMessage = useChatStore((s) => s.scrollToMessage);
  const setScrollToMessage = useChatStore((s) => s.setScrollToMessage);

  const groupedMessages: MessageGroup[] = useMemo(() => {
    return messages.reduce<MessageGroup[]>((groups, message: Message) => {
      const messageDate = new Date(message.timestamp);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && isSameDay(lastGroup.date, messageDate)) {
        return [
          ...groups.slice(0, -1),
          { ...lastGroup, messages: [...lastGroup.messages, message] },
        ];
      }
      return [...groups, { date: messageDate, messages: [message] }];
    }, []);
  }, [messages]);

  // ---- Track pinned-to-bottom on scroll --------------------------------
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;

    const onScroll = () => {
      const distanceFromBottom =
        root.scrollHeight - root.scrollTop - root.clientHeight;
      pinnedToBottomRef.current = distanceFromBottom <= PIN_THRESHOLD_PX;
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, [number]);

  // ---- Pin reset + scroll-to-target + fallback -------------------------
  //
  // All pin transitions happen here, in one deterministic order per
  // commit. Nothing outside this layout effect writes to
  // `pinnedToBottomRef`.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;

    // Conversation changed: reset the pin.
    if (prevNumberRef.current !== number) {
      prevNumberRef.current = number;
      pinnedToBottomRef.current = true;
    }

    const isPending =
      scrollToMessage !== null && scrollToMessage.number === number;

    if (isPending) {
      const el = root.querySelector(
        `[data-msg-timestamp="${scrollToMessage.timestamp}"]`,
      );
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "auto", block: "center" });
        pinnedToBottomRef.current = false;
        setScrollToMessage(null);
      }
      return;
    }

    if (pinnedToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, number, scrollToMessage, setScrollToMessage]);

  return (
    <div ref={rootRef} className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {groupedMessages.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-2">
            <div className="flex justify-center">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {formatDateHeader(group.date)}
              </span>
            </div>
            {group.messages.map((message, mi) => {
              const prev = group.messages[mi - 1];
              const next = group.messages[mi + 1];
              const isFirstInGroup =
                !prev ||
                prev.isIncoming !== message.isIncoming ||
                prev.subscription_id !== message.subscription_id;
              const isLastInGroup =
                !next ||
                next.isIncoming !== message.isIncoming ||
                next.subscription_id !== message.subscription_id;
              return (
                <div
                  key={`${message.timestamp}-${mi}`}
                  data-msg-timestamp={message.timestamp}
                >
                  <MessageBubble
                    message={message}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                  />
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default MessageList;
