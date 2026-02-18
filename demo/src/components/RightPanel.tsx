import { FACILITY_KEYS } from "@/addresses";
import { FACILITY_META } from "@/constants";
import { fmt } from "@/helpers";
import type { EventEntry } from "@/types";
import { SectionHeader } from "./SectionHeader";
import { EventRow } from "./EventRow";

export function RightPanel({
  balances,
  events,
  onRefresh,
}: {
  balances: Record<string, bigint>;
  events: EventEntry[];
  onRefresh: () => void;
}) {
  return (
    <div className="right-panel">
      {/* Balances Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionHeader style={{ margin: 0 }}>Balances</SectionHeader>
          <button
            onClick={onRefresh}
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 4,
            }}
          >
            Refresh
          </button>
        </div>

        {["Prime 1", "Prime 2", "Halo"].map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
              fontSize: 12,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>{label}</span>
            <span style={{ color: "var(--text-secondary)" }}>
              {balances[label] !== undefined ? fmt(balances[label]) : "\u2014"} sUSDS
            </span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 6, paddingTop: 6 }}>
          {FACILITY_KEYS.map((key) => (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 3,
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>
                {FACILITY_META[key].label}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                {balances[`Facility:${key}`] !== undefined
                  ? fmt(balances[`Facility:${key}`])
                  : "\u2014"}{" "}
                sUSDS
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Events Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
          minHeight: 300,
          maxHeight: "calc(100vh - 400px)",
          overflowY: "auto",
        }}
      >
        <SectionHeader>Events ({events.length})</SectionHeader>
        {events.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 8 }}>
            No events yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...events].reverse().map((ev, i) => (
              <EventRow key={i} ev={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
