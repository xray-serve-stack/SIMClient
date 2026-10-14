import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore } from "@/store/chatStore";
import { getDefaultSim } from "@/store/simsHelpers";
import ContactPicker from "@/components/chat/ContactPicker";
import EmojiPicker from "@/components/chat/EmojiPicker";
import SimSelector from "@/components/chat/SimSelector";

const messageSchema = z.object({
  content: z
    .string()
    .min(1)
    .refine((v) => v.trim().length > 0),
});

const MAX_TEXTAREA_HEIGHT = 120;

function NewConversation() {
  const navigate = useNavigate();
  const sims = useChatStore((s) => s.sims);
  const sendSms = useChatStore((s) => s.sendSms);
  const conversations = useChatStore((s) => s.conversations);

  const [recipient, setRecipient] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const defaultSim = getDefaultSim(sims);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<{ content: string }>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: "" },
  });

  const {
    ref: contentRef,
    onChange: onContentChange,
    ...contentField
  } = register("content");

  const canSend = useMemo(
    () => recipient.trim().length > 0 && defaultSim !== undefined,
    [recipient, defaultSim],
  );

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const onSubmit = (data: { content: string }) => {
    const body = data.content.trim();
    if (!body) return;
    const trimmedRecipient = recipient.trim();
    if (!trimmedRecipient) return;
    sendSms(trimmedRecipient, body);
    reset();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    navigate(`/chat/${encodeURIComponent(trimmedRecipient)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setValue("content", `${getValues("content")}${emoji}`, {
      shouldValidate: true,
    });
    setFocus("content");
  };

  const handlePickContact = (number: string) => {
    setRecipient(number);
    setPickerOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold">New conversation</span>
      </header>

      <div className="border-b border-border p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPickerOpen(true)}
            aria-label="Pick contact"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Input
            type="text"
            placeholder="Recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1" />

      <div className="border-t border-border p-4">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <div className="relative flex-1">
            <Textarea
              {...contentField}
              ref={(el) => {
                contentRef(el);
                textareaRef.current = el;
              }}
              rows={1}
              placeholder="Message..."
              onChange={(e) => {
                onContentChange(e);
                autoResize(e.target);
              }}
              onKeyDown={handleKeyDown}
              className={`max-h-[120px] resize-none pr-12 ${errors.content ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            <div className="absolute bottom-1 right-1">
              <EmojiPicker onSelect={handleEmojiSelect} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <SimSelector />
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={!canSend}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
        {errors.content && (
          <p
            className="mx-auto mt-2 max-w-3xl text-center text-sm text-destructive"
            role="alert"
          >
            {errors.content.message}
          </p>
        )}
      </div>

      {pickerOpen && (
        <ContactPicker
          onPick={handlePickContact}
          onClose={() => setPickerOpen(false)}
          existingNumbers={conversations.map((c) => c.number)}
        />
      )}
    </div>
  );
}

export default NewConversation;
