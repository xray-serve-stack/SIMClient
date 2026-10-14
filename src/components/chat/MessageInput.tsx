import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore } from "@/store/chatStore";
import EmojiPicker from "./EmojiPicker";
import SimSelector from "./SimSelector";

const messageSchema = z.object({
  content: z
    .string()
    .min(1)
    .refine((v) => v.trim().length > 0),
});

interface MessageInputProps {
  conversationNumber: string;
}

const MAX_TEXTAREA_HEIGHT = 120;

function MessageInput({ conversationNumber }: MessageInputProps) {
  const sendSms = useChatStore((s) => s.sendSms);
  const draftFromStore = useChatStore(
    (s) => s.drafts[conversationNumber] ?? "",
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  useEffect(() => {
    setValue("content", draftFromStore, { shouldValidate: false });
  }, [draftFromStore, setValue]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const onSubmit = (data: { content: string }) => {
    const body = data.content.trim();
    if (!body) return;
    sendSms(conversationNumber, body);
    reset();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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

  return (
    <div className="border-t border-border p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto flex max-w-3xl items-end gap-2"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Add attachment"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <div className="relative flex-1">
          <Textarea
            {...contentField}
            ref={(el) => {
              contentRef(el);
              textareaRef.current = el;
            }}
            rows={1}
            placeholder="Type a message..."
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
          <Button type="submit" size="icon" aria-label="Send message">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
      {errors.content && (
        <p className="mt-2 text-center text-sm text-destructive" role="alert">
          {errors.content.message}
        </p>
      )}
    </div>
  );
}

export default MessageInput;
