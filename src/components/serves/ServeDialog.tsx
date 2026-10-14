import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/store/chatStore";
import type { Serve } from "@/cache/servesRepository";

interface ServeDialogProps {
  mode: "create" | "edit";
  /** Required when mode === "edit". */
  serve?: Serve;
  onClose: () => void;
}

function ServeDialog({ mode, serve, onClose }: ServeDialogProps) {
  const createServe = useChatStore((s) => s.createServe);
  const renameServe = useChatStore((s) => s.renameServe);
  const lastSendError = useChatStore((s) => s.lastSendError);
  const clearLastSendError = useChatStore((s) => s.clearLastSendError);

  const [deviceName, setDeviceName] = useState(serve?.device_name ?? "");
  const [publicKey, setPublicKey] = useState(serve?.public_key ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    // Clear any previous error when the dialog opens.
    clearLastSendError();
  }, [clearLastSendError]);

  const title = mode === "create" ? "Add Serve" : "Edit Serve";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = deviceName.trim();
    const trimmedKey = publicKey.trim();

    if (!trimmedName) {
      setLocalError("Device name is required");
      return;
    }
    if (mode === "create" && !trimmedKey) {
      setLocalError("Public key is required");
      return;
    }
    setLocalError(null);

    if (mode === "create") {
      createServe(trimmedKey, trimmedName);
    } else if (serve?.id !== undefined) {
      renameServe(serve.id, trimmedName);
    }
    onClose();
  };

  const displayError = localError ?? lastSendError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-border bg-background shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="font-medium">{title}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Device name</span>
            <Input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. My phone"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Public key</span>
            <Input
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="Base64 X25519 public key"
              readOnly={mode === "edit"}
              className={mode === "edit" ? "opacity-70" : ""}
            />
            {mode === "edit" && (
              <span className="text-xs text-muted-foreground">
                Public key is the Serve identity and cannot be changed.
              </span>
            )}
          </label>

          {displayError && (
            <p className="text-sm text-destructive" role="alert">
              {displayError}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {mode === "create" ? "Add Serve" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ServeDialog;
