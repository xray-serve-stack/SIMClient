import { useState } from "react";
import {
  MessageCircle,
  Moon,
  Sun,
  MessageSquarePlus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ConversationItem from "./ConversationItem";
import ServeList from "@/components/serves/ServeList";
import NetworkStatsFooter from "./NetworkStatsFooter";
import SearchDialog from "@/components/search/SearchDialog";
import { useChatStore } from "@/store/chatStore";
import { useThemeStore } from "@/store/themeStore";
import { useNavigate } from "react-router-dom";

function Sidebar() {
  const conversations = useChatStore((s) => s.conversations);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Messages</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="text-muted-foreground hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/new")}
            aria-label="New conversation"
            className="text-muted-foreground hover:text-foreground"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      <ServeList />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {conversations.length > 0 ? (
            conversations.map((c) => (
              <ConversationItem key={c.number} conversation={c} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No conversations yet
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <NetworkStatsFooter />

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

export default Sidebar;
