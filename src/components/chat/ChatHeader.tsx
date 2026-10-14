import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Phone, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chatStore";

function ChatHeader() {
  const navigate = useNavigate();
  const { number } = useParams<{ number: string }>();
  const conversation = useChatStore((s) =>
    number ? s.getConversationByNumber(decodeURIComponent(number)) : undefined,
  );

  if (!conversation) return null;

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="md:hidden"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col">
          <span className="font-semibold">{conversation.contactName}</span>
          <span className="text-xs text-muted-foreground">
            {conversation.number}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Call"
          className="text-muted-foreground hover:text-foreground"
        >
          <Phone className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="More options"
          className="text-muted-foreground hover:text-foreground"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

export default ChatHeader;
