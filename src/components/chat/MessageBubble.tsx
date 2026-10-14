import { Message } from "@/types";
import { cn, formatTime } from "@/lib/utils";
import { useChatStore } from "@/store/chatStore";
import { subscriptionIdToOrdinal } from "@/store/simsHelpers";

interface MessageBubbleProps {
  message: Message;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  if (status === null) return null;
  const glyph =
    status === "sent"
      ? "✓✓"
      : status === "outbox" || status === "queued"
        ? "✓"
        : "✗";
  const label = `Status: ${status}`;
  return (
    <span
      className="text-xs text-muted-foreground/80 tabular-nums"
      title={label}
      aria-label={label}
    >
      {glyph}
    </span>
  );
}

function MessageBubble({
  message,
  isFirstInGroup,
  isLastInGroup,
}: MessageBubbleProps) {
  const isOwn = !message.isIncoming;

  // SIM label is derived at the UI boundary from the current SIM list.
  // A message whose SIM is not in the list still renders; the label
  // falls back to the subscription_id itself.
  const sims = useChatStore((s) => s.sims);
  const ordinal = subscriptionIdToOrdinal(sims, message.subscription_id);
  const simLabel =
    ordinal !== undefined ? `SIM ${ordinal}` : `SIM ${message.subscription_id}`;

  const metaBubbleClass = isOwn
    ? "bg-primary-foreground/15 text-primary-foreground/80"
    : "bg-foreground/10 text-muted-foreground";

  return (
    <div
      className={cn(
        "flex w-full animate-fade-in",
        isOwn ? "justify-end" : "justify-start",
        !isLastInGroup && "mb-0.5",
      )}
    >
      <div
        className={cn(
          "max-w-[75%] px-4 py-2 sm:max-w-[65%]",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          isOwn
            ? cn(
                "rounded-2xl",
                isFirstInGroup && "rounded-tr-md",
                isLastInGroup && "rounded-br-md",
                !isFirstInGroup && !isLastInGroup && "rounded-r-md",
              )
            : cn(
                "rounded-2xl",
                isFirstInGroup && "rounded-tl-md",
                isLastInGroup && "rounded-bl-md",
                !isFirstInGroup && !isLastInGroup && "rounded-l-md",
              ),
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.body}
        </p>
        <div
          className={cn(
            "mt-1 flex items-center gap-2",
            isOwn ? "justify-end" : "justify-start",
          )}
        >
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
              metaBubbleClass,
            )}
          >
            {formatTime(new Date(message.timestamp))}
          </span>
          {isOwn && <StatusIcon status={message.status} />}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
              metaBubbleClass,
            )}
            title={simLabel}
          >
            {simLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
