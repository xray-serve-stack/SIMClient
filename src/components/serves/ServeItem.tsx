import type { Serve } from "@/cache/servesRepository";
import { cn } from "@/lib/utils";
import ServeMenu from "./ServeMenu";

interface ServeItemProps {
  serve: Serve;
  isActive: boolean;
  status: "online" | "offline";
  onSelect: (serveId: number) => void;
  onEdit: (serve: Serve) => void;
  onDelete: (serve: Serve) => void;
}

function ServeItem({
  serve,
  isActive,
  status,
  onSelect,
  onEdit,
  onDelete,
}: ServeItemProps) {
  const isOnline = status === "online";
  const serveId = serve.id;

  const handleClick = () => {
    if (typeof serveId === "number") onSelect(serveId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-current={isActive ? "true" : undefined}
      aria-label={`${serve.device_name} ΓÇö ${isOnline ? "online" : "offline"}${isActive ? ", active" : ""}`}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md py-2 pr-1 pl-4 text-left transition-colors",
        "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isActive && "bg-accent",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 bottom-1 w-0.5 rounded-full",
          isActive ? "bg-[#E05252]" : "bg-transparent",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          isOnline ? "bg-[#4CAF72]" : "bg-[#8A8F98]",
        )}
      />
      <span className="flex-1 truncate text-sm font-medium">
        {serve.device_name}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {isOnline ? "online" : "offline"}
      </span>
      <ServeMenu
        onEdit={() => onEdit(serve)}
        onDelete={() => onDelete(serve)}
      />
    </div>
  );
}

export default ServeItem;
