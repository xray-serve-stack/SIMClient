import { useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  NetworkStats,
  type NetworkStatsSnapshot,
} from "@/network/NetworkStats";

/**
 * Byte formatter for the footer.
 *
 * Base-10 units (1 kB = 1000 B), matching DevTools' Network tab and
 * carrier-style MB reporting.
 *
 * One decimal at every unit above bytes, so changes are visible at the
 * 100 B level in kB and at the 100 kB level in MB. Below 1000 bytes the
 * value is byte-precise and printed as an integer.
 *
 * Examples: 0B, 824B, 1.2kB, 34.5kB, 1.2MB, 3.4MB, 1.1GB.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes}B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(1)}kB`;
  if (bytes < 1000 * 1000 * 1000) {
    return `${(bytes / (1000 * 1000)).toFixed(1)}MB`;
  }
  return `${(bytes / (1000 * 1000 * 1000)).toFixed(1)}GB`;
}

/**
 * Read the current snapshot once, at subscribe time, so React does not
 * see a torn value across the initial subscribe / snapshot pair.
 */
function getSnapshot(): NetworkStatsSnapshot {
  return NetworkStats.getStats();
}

/**
 * The external store never changes identity between reads for the same
 * counter values, because `getStats` returns a fresh object each call.
 * React uses reference equality to decide whether to re-render, so we
 * must stabilise the snapshot.
 *
 * Caching the snapshot here means `getSnapshot` returns the same object
 * until a real update happens. `subscribe` is expected to call the
 * listener after every counter change, at which point the cache is
 * invalidated by the module's own `notify`.
 */
let cached: NetworkStatsSnapshot | null = null;

function getStableSnapshot(): NetworkStatsSnapshot {
  if (cached === null) {
    cached = getSnapshot();
  }
  return cached;
}

// Invalidate the cache whenever the store notifies.
NetworkStats.subscribe(() => {
  cached = null;
});

function NetworkStatsFooter() {
  const stats = useSyncExternalStore(
    (listener) => NetworkStats.subscribe(() => listener()),
    getStableSnapshot,
    getStableSnapshot,
  );

  return (
    <footer className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center justify-center gap-4 tabular-nums">
        {/* Send group */}
        <div className="flex items-center gap-1">
          <ArrowUp
            className="h-3 w-3 shrink-0 text-muted-foreground/70"
            aria-hidden
          />
          <span className="text-muted-foreground/70">send</span>
          <span className="text-foreground/80">{stats.sendCount}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-foreground/80">
            {formatBytes(stats.sendBytes)}
          </span>
        </div>

        {/* Divider between the two groups */}
        <div className="h-3 w-px bg-border" aria-hidden />

        {/* Receive group */}
        <div className="flex items-center gap-1">
          <ArrowDown
            className="h-3 w-3 shrink-0 text-muted-foreground/70"
            aria-hidden
          />
          <span className="text-muted-foreground/70">receive</span>
          <span className="text-foreground/80">{stats.receiveCount}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-foreground/80">
            {formatBytes(stats.receiveBytes)}
          </span>
        </div>
      </div>
    </footer>
  );
}

export default NetworkStatsFooter;
