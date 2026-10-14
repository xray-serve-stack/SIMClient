import { useChatStore } from "@/store/chatStore";
import { getDefaultSim } from "@/store/simsHelpers";
import { Button } from "@/components/ui/button";
import type { Sim } from "@/types";

interface SimSelectorProps {
  /** Optional override. When provided, the parent owns the value. */
  value?: number | null;
  /** Optional override. Called with the new subscription_id. */
  onChange?: (id: number | null) => void;
}

function describeSim(sim: Sim): string {
  const label =
    (typeof sim.display_name === "string" && sim.display_name.length > 0
      ? sim.display_name
      : undefined) ??
    (typeof sim.carrier_name === "string" && sim.carrier_name.length > 0
      ? sim.carrier_name
      : undefined) ??
    `SIM ${sim.subscription_id}`;
  return `${label} (ordinal ${sim.ordinal})`;
}

/**
 * Cyclic SIM selector.
 *
 * Shows the currently selected SIM as `SIM <ordinal>`. Clicking advances
 * to the next SIM in the store's list, wrapping to the first. If the
 * store has no explicit selection, the default SIM (per `getDefaultSim`)
 * is shown and the first click moves to the next SIM after it.
 *
 * The selection is in-memory and scoped to the active Serve; it is not
 * persisted per conversation and is not sent as a selector state on the
 * wire. `sendSms` reads it to choose the outgoing SIM.
 */
function SimSelector({ value, onChange }: SimSelectorProps = {}) {
  const sims = useChatStore((s) => s.sims);
  const selectedSubscriptionId = useChatStore((s) => s.selectedSubscriptionId);
  const setSelectedSubscriptionId = useChatStore(
    (s) => s.setSelectedSubscriptionId,
  );

  if (sims.length === 0) {
    return null;
  }

  // Resolve the current value: explicit prop > store selection > default.
  const effectiveSubscriptionId =
    value !== undefined
      ? value
      : (selectedSubscriptionId ??
        getDefaultSim(sims)?.subscription_id ??
        null);

  const currentIndex = Math.max(
    0,
    sims.findIndex((s) => s.subscription_id === effectiveSubscriptionId),
  );
  const currentSim = sims[currentIndex];

  const cycle = () => {
    if (sims.length === 0) return;
    const next = sims[(currentIndex + 1) % sims.length];
    if (onChange) {
      onChange(next.subscription_id);
    } else {
      setSelectedSubscriptionId(next.subscription_id);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={cycle}
      className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground hover:text-foreground"
      aria-label={`Selected SIM: SIM ${currentSim?.ordinal ?? "?"}. Click to change.`}
      title={currentSim ? describeSim(currentSim) : undefined}
    >
      SIM {currentSim?.ordinal ?? "?"}
    </Button>
  );
}

export default SimSelector;
