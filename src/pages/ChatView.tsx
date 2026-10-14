import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useChatStore } from "@/store/chatStore";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";

function ChatView() {
  const { number } = useParams<{ number: string }>();
  const setActiveChat = useChatStore((s) => s.setActiveChat);

  const decoded = number ? decodeURIComponent(number) : undefined;

  useEffect(() => {
    if (!decoded) return;
    setActiveChat(decoded);
  }, [decoded, setActiveChat]);

  if (!decoded) return null;

  return (
    <div className="flex h-full flex-col">
      <ChatHeader />
      <MessageList number={decoded} />
      <MessageInput conversationNumber={decoded} />
    </div>
  );
}

export default ChatView;
