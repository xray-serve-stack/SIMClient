import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X } from "lucide-react";

interface ContactPickerProps {
  onPick: (number: string) => void;
  onClose: () => void;
  /** Numbers that already have a conversation. Only used for a small hint. */
  existingNumbers: string[];
}

function ContactPicker({
  onPick,
  onClose,
  existingNumbers,
}: ContactPickerProps) {
  const contacts = useChatStore((s) => s.contacts);
  const requestContacts = useChatStore((s) => s.requestContacts);

  useEffect(() => {
    requestContacts();
  }, [requestContacts]);

  const existing = new Set(existingNumbers);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="font-medium">Select contact</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {contacts.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No contacts
            </p>
          ) : (
            contacts.map((c) => {
              const initials = c.displayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onPick(c.number)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{c.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.number}
                    </span>
                  </div>
                  {existing.has(c.number) && (
                    <span className="text-[10px] uppercase text-muted-foreground">
                      Existing
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactPicker;
