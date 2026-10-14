import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore } from "@/store/chatStore";
import type { Serve } from "@/cache/servesRepository";
import ServeItem from "./ServeItem";
import ServeDialog from "./ServeDialog";

/**
 * Height of the expanded Serves viewport when the list must scroll.
 * Roughly 7 rows at the current ServeItem height plus the container
 * padding. When 7 or fewer Serves exist, no fixed height is applied and
 * the container sizes to its content.
 */
const VISIBLE_SERVE_ROWS = 7;
const EXPANDED_LIST_HEIGHT_PX = 250;

function ServeList() {
  const serves = useChatStore((s) => s.serves);
  const activeServeId = useChatStore((s) => s.activeServeId);
  const servePresence = useChatStore((s) => s.servePresence);
  const setActiveServe = useChatStore((s) => s.setActiveServe);
  const deleteServe = useChatStore((s) => s.deleteServe);
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(false);
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; serve: Serve } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<Serve | null>(null);

  const activeServe =
    activeServeId !== null
      ? serves.find((s) => s.id === activeServeId)
      : undefined;

  const activeStatus =
    activeServe?.id !== undefined
      ? (servePresence[activeServe.id] ?? "offline")
      : "offline";

  // Fixed viewport height only when the list would overflow. This is
  // what makes Radix's ScrollArea actually show a scrollbar: the
  // viewport needs a bounded height to have overflow at all.
  const needsScroll = serves.length > VISIBLE_SERVE_ROWS;

  const handleHeaderClick = () => {
    if (serves.length === 0) {
      setDialog({ mode: "create" });
      return;
    }
    setExpanded((v) => !v);
  };

  const handlePickServe = (serveId: number) => {
    navigate("/");
    void setActiveServe(serveId);
    setExpanded(false);
  };

  return (
    <div className="border-b border-border pb-2">
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Serves
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDialog({ mode: "create" })}
            aria-label="Add Serve"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleHeaderClick}
            aria-label={expanded ? "Collapse Serves" : "Expand Serves"}
            aria-expanded={expanded}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            disabled={serves.length === 0}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {!expanded && activeServe && (
        <div className="px-2 pr-4">
          <ServeItem
            serve={activeServe}
            isActive
            status={activeStatus}
            onSelect={handleHeaderClick}
            onEdit={(s) => setDialog({ mode: "edit", serve: s })}
            onDelete={(s) => setConfirmDelete(s)}
          />
        </div>
      )}

      {expanded && (
        <ScrollArea
          className="px-2"
          style={
            needsScroll ? { height: `${EXPANDED_LIST_HEIGHT_PX}px` } : undefined
          }
        >
          <div className="flex flex-col gap-0.5 pb-1 pr-2">
            {serves.map((serve) => {
              const status =
                serve.id !== undefined
                  ? (servePresence[serve.id] ?? "offline")
                  : "offline";
              return (
                <ServeItem
                  key={serve.id ?? serve.public_key}
                  serve={serve}
                  isActive={serve.id === activeServeId}
                  status={status}
                  onSelect={handlePickServe}
                  onEdit={(s) => setDialog({ mode: "edit", serve: s })}
                  onDelete={(s) => setConfirmDelete(s)}
                />
              );
            })}
          </div>
        </ScrollArea>
      )}

      {dialog && (
        <ServeDialog
          mode={dialog.mode}
          serve={dialog.mode === "edit" ? dialog.serve : undefined}
          onClose={() => setDialog(null)}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-background p-4 shadow-lg">
            <p className="mb-3 text-sm">
              Delete <strong>{confirmDelete.device_name}</strong>? This cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (typeof confirmDelete.id === "number") {
                    deleteServe(confirmDelete.id);
                  }
                  setConfirmDelete(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServeList;
