// src/components/search/ServeChips.tsx

import { useChatStore } from "@/store/chatStore";
import { cn } from "@/lib/utils";

interface ServeChipsProps {
  selectedServeIds: ReadonlySet<number>;
  /** Toggle a single Serve on or off. Must not be called with the last
   *  selected id when it would empty the selection. */
  onToggle: (serveId: number) => void;
  /** Invert the current selection. */
  onReverse: () => void;
  /** Replace the selection with all currently-online Serves. */
  onSelectOnline: () => void;
  /** Replace the selection with all currently-offline Serves. */
  onSelectOffline: () => void;
}

/**
 * Multi-select chip row for the Serves that participate in the search.
 * At least one Serve must remain selected; the dialog enforces that
 * before running a search.
 */
function ServeChips({
  selectedServeIds,
  onToggle,
  onReverse,
  onSelectOnline,
  onSelectOffline,
}: ServeChipsProps) {
  const serves = useChatStore((s) => s.serves);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">Serves:</span>
      {serves.map((s) => {
        const id = s.id;
        if (typeof id !== "number") return null;
        const selected = selectedServeIds.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            className={cn(
              "rounded border px-2 py-0.5 text-xs transition-colors",
              selected
                ? "border-ring bg-accent text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/50",
            )}
            aria-pressed={selected}
          >
            {s.device_name}
          </button>
        );
      })}

      <div className="ml-1 flex items-center gap-1">
        <button
          type="button"
          onClick={onReverse}
          className="rounded border border-transparent px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50"
          aria-label="Reverse selection"
          title="Reverse selection"
        >
          reverse
        </button>
        <button
          type="button"
          onClick={onSelectOnline}
          className="rounded border border-transparent px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50"
          aria-label="Select online Serves"
          title="Select online Serves"
        >
          online
        </button>
        <button
          type="button"
          onClick={onSelectOffline}
          className="rounded border border-transparent px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50"
          aria-label="Select offline Serves"
          title="Select offline Serves"
        >
          offline
        </button>
      </div>
    </div>
  );
}

export default ServeChips;
