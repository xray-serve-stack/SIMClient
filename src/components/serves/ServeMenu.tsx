import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServeMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

interface MenuPosition {
  /** Fixed-position coordinates (viewport space) for the menu. */
  left: number;
  top: number;
  /** Whether the menu is anchored above the button (true) or below it. */
  above: boolean;
}

const MENU_WIDTH_PX = 128; // matches w-32
const MENU_GAP_PX = 4;
const MENU_ESTIMATED_HEIGHT_PX = 72;

function ServeMenu({ onEdit, onDelete }: ServeMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  // Position the menu against the button in viewport space. Recomputes
  // whenever the menu opens and whenever the viewport or the layout
  // changes while it is open.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const compute = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const above =
        spaceBelow < MENU_ESTIMATED_HEIGHT_PX + MENU_GAP_PX &&
        spaceAbove > spaceBelow;

      const left = Math.min(
        Math.max(rect.right - MENU_WIDTH_PX, 4),
        window.innerWidth - MENU_WIDTH_PX - 4,
      );
      const top = above
        ? rect.top - MENU_GAP_PX - MENU_ESTIMATED_HEIGHT_PX
        : rect.bottom + MENU_GAP_PX;

      setPosition({ left, top, above });
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);

    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleEdit = () => {
    setOpen(false);
    onEdit();
  };
  const handleDelete = () => {
    setOpen(false);
    onDelete();
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Serve actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              left: position.left,
              top: position.top,
              width: MENU_WIDTH_PX,
            }}
            className="z-50 rounded-md border border-border bg-popover p-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleEdit}
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleDelete}
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
            >
              Delete
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default ServeMenu;
