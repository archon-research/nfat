import { FACILITY_META } from "@/constants";
import { fmt, truncAddr, labelForAddr } from "@/helpers";
import type { NfatInfo, EventEntry } from "@/types";
import { EventRow } from "./EventRow";

export function NfatTableRow({
  n,
  isExpanded,
  nfatEvents,
  onToggle,
}: {
  n: NfatInfo;
  isExpanded: boolean;
  nfatEvents: EventEntry[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderTop: "1px solid var(--border)",
          cursor: "pointer",
          background: isExpanded ? "var(--bg-inset)" : "transparent",
        }}
      >
        <td style={{ padding: "8px", fontWeight: 600 }}>#{n.tokenId}</td>
        <td style={{ padding: "8px" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: FACILITY_META[n.facility].color,
              display: "inline-block",
              marginRight: 6,
            }}
          />
          {FACILITY_META[n.facility].label}
        </td>
        <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 12 }}>
          {truncAddr(n.depositor)}{" "}
          <span style={{ color: "var(--text-dim)", fontFamily: "sans-serif" }}>
            ({labelForAddr(n.depositor)})
          </span>
        </td>
        <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 12 }}>
          {truncAddr(n.owner)}{" "}
          <span style={{ color: "var(--text-dim)", fontFamily: "sans-serif" }}>
            ({labelForAddr(n.owner)})
          </span>
        </td>
        <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace" }}>
          {fmt(n.principal)} sUSDS
        </td>
        <td
          style={{
            padding: "8px",
            textAlign: "right",
            fontFamily: "monospace",
            color: n.claimable > 0n ? "var(--positive)" : "var(--text-muted)",
          }}
        >
          {fmt(n.claimable)} sUSDS
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} style={{ padding: "12px 16px", background: "var(--bg-inset)" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              Minted {new Date(n.mintedAt * 1000).toLocaleString()}
            </div>
            <h4
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Event History
            </h4>
            {nfatEvents.length === 0 ? (
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No events</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {nfatEvents.map((ev, i) => (
                  <EventRow key={i} ev={ev} showDot={false} />
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
