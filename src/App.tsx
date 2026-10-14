import { Routes, Route, Navigate } from "react-router-dom";
import ChatLayout from "@/layouts/ChatLayout";
import ChatView from "@/pages/ChatView";
import EmptyChat from "@/pages/EmptyChat";
import NewConversation from "@/pages/NewConversation";
import { useApplyTheme } from "@/hooks/useApplyTheme";

function App() {
  useApplyTheme();
  return (
    <Routes>
      <Route path="/" element={<ChatLayout />}>
        <Route index element={<EmptyChat />} />
        <Route path="chat/:number" element={<ChatView />} />
        <Route path="new" element={<NewConversation />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
