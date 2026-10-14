import { useNavigate, useParams } from "react-router-dom";
import { Conversation } from "@/types";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";

interface ConversationItemProps {
  conversation: Conversation;
}

function ConversationItem({ conversation }: ConversationItemProps) {
  const navigate = useNavigate();
  const { number: activeNumber } = useParams<{ number: string }>();
  const isActive = activeNumber === conversation.number;

  const truncatedPreview =
    conversation.preview.length > 50
      ? `${conversation.preview.substring(0, 50)}…`
      : conversation.preview;

  return (
    <button
      onClick={() =>
        navigate(`/chat/${encodeURIComponent(conversation.number)}`)
      }
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg p-2.5 text-left transition-colors",
        "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isActive && "bg-accent",
      )}
    >
      {/* Row 1: NAME | NUMBER | TIME, three fixed-shape glass boxes */}
      <div className="flex w-full items-center gap-2">
        {/* NAME — fills all remaining space, even when empty */}
        <span className="min-w-0 flex-1 truncate font-medium">
          {conversation.contactName || "\u00A0"}
        </span>

        {/* NUMBER — fixed 15ch box, right-aligned so digits line up */}
        <span className="w-[15ch] shrink-0 truncate text-right text-xs tabular-nums text-muted-foreground">
          {conversation.number}
        </span>

        {/* TIME — fixed 7ch box, right-aligned, tabular digits */}
        <span className="w-[7ch] shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {formatRelativeTime(conversation.timestamp)}
        </span>
      </div>

      {/* Row 2: PREVIEW | unread badge */}
      <div className="flex w-full items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {truncatedPreview}
        </span>
        {conversation.unread && (
          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            1
          </span>
        )}
      </div>
    </button>
  );
}

export default ConversationItem;
