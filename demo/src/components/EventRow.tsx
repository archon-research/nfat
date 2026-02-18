import { FACILITY_META } from "@/constants";
import { fmt, labelForAddr } from "@/helpers";
import type { EventEntry } from "@/types";

export function EventRow({
  ev,
  onClick,
  showDot = true,
}: {
  ev: EventEntry;
  onClick?: () => void;
  showDot?: boolean;
}) {
  let detail = "";

  if (ev.action === "Deposited" || ev.action === "Withdrawn") {
    const amt = ev.args.amount as bigint;
    const dep = ev.args.depositor as string;
    detail = `${labelForAddr(dep)} \u2014 ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Issued") {
    const amt = ev.args.amount as bigint;
    const dep = ev.args.depositor as string;
    detail = `#${ev.tokenId} to ${labelForAddr(dep)} \u2014 ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Funded") {
    const amt = ev.args.amount as bigint;
    const funder = ev.args.funder as string;
    detail = `#${ev.tokenId} by ${labelForAddr(funder)} \u2014 ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Claimed") {
    const amt = ev.args.amount as bigint;
    const claimer = ev.args.claimer as string;
    detail = `#${ev.tokenId} by ${labelForAddr(claimer)} \u2014 ${fmt(amt)} sUSDS`;
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 4,
        cursor: onClick ? "pointer" : "default",
        fontSize: 12,
      }}
    >
      {showDot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: FACILITY_META[ev.facility].color,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ color: "var(--text-primary)", fontWeight: 600, width: 72, flexShrink: 0 }}>
        {ev.action}
      </span>
      <span style={{ color: "var(--text-secondary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {detail}
      </span>
      {onClick && <span style={{ color: "var(--text-dim)", fontSize: 14 }}>&rsaquo;</span>}
    </div>
  );
}
